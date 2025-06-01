

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";


// SLERP 회전 보간을 위한 쿼터니언 유틸
class Versor {
    static fromAngles([l, p, g]) {
        l *= Math.PI / 360;
        p *= Math.PI / 360;
        g *= Math.PI / 360;
        const sl = Math.sin(l), cl = Math.cos(l);
        const sp = Math.sin(p), cp = Math.cos(p);
        const sg = Math.sin(g), cg = Math.cos(g);
        return [
            cl * cp * cg + sl * sp * sg,
            sl * cp * cg - cl * sp * sg,
            cl * sp * cg + sl * cp * sg,
            cl * cp * sg - sl * sp * cg
        ];
    }

    static toAngles([a, b, c, d]) {
        return [
            Math.atan2(2 * (a * b + c * d), 1 - 2 * (b * b + c * c)) * 180 / Math.PI,
            Math.asin(Math.max(-1, Math.min(1, 2 * (a * c - d * b)))) * 180 / Math.PI,
            Math.atan2(2 * (a * d + b * c), 1 - 2 * (c * c + d * d)) * 180 / Math.PI
        ];
    }

    static interpolateAngles(a, b) {
        const i = Versor.interpolate(Versor.fromAngles(a), Versor.fromAngles(b));
        return t => Versor.toAngles(i(t));
    }

    static interpolate([a1, b1, c1, d1], [a2, b2, c2, d2]) {
        let dot = a1 * a2 + b1 * b2 + c1 * c2 + d1 * d2;

        if (dot < 0) {
            a2 = -a2; b2 = -b2; c2 = -c2; d2 = -d2;
            dot = -dot;
        }

        if (dot > 0.9995) return Versor.interpolateLinear([a1, b1, c1, d1], [a2, b2, c2, d2]);

        const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
        const sinTheta0 = Math.sin(theta0);
        const x = new Array(4);

        a2 -= a1 * dot;
        b2 -= b1 * dot;
        c2 -= c1 * dot;
        d2 -= d1 * dot;
        const len = Math.hypot(a2, b2, c2, d2);
        a2 /= len; b2 /= len; c2 /= len; d2 /= len;

        return t => {
            const theta = theta0 * t;
            const s = Math.sin(theta);
            const c = Math.cos(theta);
            x[0] = a1 * c + a2 * s;
            x[1] = b1 * c + b2 * s;
            x[2] = c1 * c + c2 * s;
            x[3] = d1 * c + d2 * s;
            return x;
        };
    }

    static interpolateLinear([a1, b1, c1, d1], [a2, b2, c2, d2]) {
        a2 -= a1; b2 -= b1; c2 -= c1; d2 -= d1;
        const x = new Array(4);
        return t => {
            x[0] = a1 + a2 * t;
            x[1] = b1 + b2 * t;
            x[2] = c1 + c2 * t;
            x[3] = d1 + d2 * t;
            const len = Math.hypot(...x);
            x[0] /= len; x[1] /= len; x[2] /= len; x[3] /= len;
            return x;
        };
    }
}
const WorldMap = () => {
    const canvasRef   = useRef(null);      // 캔버스 DOM
    const resetRef    = useRef(null);      // 외부에서 애니메이션 리셋용

    useEffect(() => {
        /* ==========[ 초기 설정 ]========== */
        const width  = window.innerWidth  * 1.5;
        const height = window.innerHeight * 1.5;
        const dpr    = window.devicePixelRatio || 1;

        const canvas = d3
            .select(canvasRef.current)
            .attr("width",  dpr * width)
            .attr("height", dpr * height)
            .style("width",  `${width}px`)
            .style("height", `${height}px`);

        const ctx = canvas.node().getContext("2d");
        ctx.scale(dpr, dpr);

        const projection = d3
            .geoOrthographic()
            .fitExtent([[10, 10], [width - 10, height - 10]], { type: "Sphere" });

        const path = d3.geoPath(projection, ctx);

        const color = d3.scaleOrdinal(d3.schemeSet3);

        function oceanGradient(ctx, cx, cy, r) {
            const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r * 1.05);
            g.addColorStop(0,  "#0b2d59");   // 심해-남색
            g.addColorStop(0.35,"#0e3d7a");  // 깊은 푸른
            g.addColorStop(0.7, "#094a9c");  // 중간-파랑
            g.addColorStop(1,  "#023b7a");   // 테두리-군청
            return g;
        }

        const landScale = d3.scaleSequential()
            .domain([0, 1])
            .interpolator(t => d3.interpolateRgbBasis(["#1a3d2f", "#36734c", "#73ac63", "#bdb967"])(t));


        /* ==========[ 데이터 로드 ]========== */
        Promise.all([
            d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
            d3.json("nationality_tour_visits_english.json")
        ]).then(([worldRaw, visits]) => {
            const land      = topojson.feature(worldRaw, worldRaw.objects.land);
            const countries = topojson.feature(worldRaw, worldRaw.objects.countries).features;
            const borders   = topojson.mesh(worldRaw, worldRaw.objects.countries, (a, b) => a !== b);

            /* 색상 고정 */
            const countryColor = new Map(countries.map((c, i) => [c, color(i)]));

            /* 방문 순서 정렬 */
            const sorted = visits.sort((a, b) => a.country.localeCompare(b.country));

            const byName = new Map(countries.map(c => [c.properties.name, c]));
            const visitCountries = sorted.map(v => byName.get(v.country)).filter(Boolean);

            /* ==========[ 가변 상태값 ]========== */
            let p1 = [0, 0], p2 = [0, 0];
            let r1 = [0, 0, 0], r2 = [0, 0, 0];
            const tilt = 20;

            /* ==========[ 렌더 함수 ]========== */
            function render(country, arc, highlight = false, info = null) {
                ctx.clearRect(0, 0, width, height);

                /* 바다 */
                ctx.beginPath();
                path({ type: "Sphere" });
                ctx.fillStyle = oceanGradient(
                    ctx,
                    width * 0.5,
                    height * 0.5,
                    projection.scale()        // 투영 스케일 ≈ 반지름(px)
                );
                ctx.fill();

                /* 국가 면 */
                countries.forEach((c, i) => {
                    ctx.beginPath(); path(c);
                    ctx.fillStyle = landScale((i % 20) / 20); // index 로 섞어서 자연스러운 톤
                    ctx.fill();
                });

                /* 국경선 */
                ctx.beginPath(); path(borders);
                ctx.strokeStyle = "rgba(255,255,255,0.6)";
                ctx.lineWidth   = 0.4;
                ctx.stroke();

                /* 선택 국가 */
                if (country) {
                    ctx.beginPath(); path(country);
                    ctx.strokeStyle = highlight ? "#000" : "#fff";
                    ctx.lineWidth = highlight ? 2 : 0.5;
                    ctx.stroke();
                }

                /* 이동 호 */
                if (arc) {
                    ctx.beginPath(); path(arc);
                    ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.stroke();
                }

                /* 방문 정보 */
                if (info) {
                    const w = 240, h = 60;
                    const x = (width - w) / 2, y = (height / 2) - 50;

                    ctx.beginPath();
                    ctx.moveTo(x + 10, y);
                    ctx.lineTo(x + w - 10, y);
                    ctx.quadraticCurveTo(x + w, y, x + w, y + 10);
                    ctx.lineTo(x + w, y + h - 10);
                    ctx.quadraticCurveTo(x + w, y + h, x + w - 10, y + h);
                    ctx.lineTo(x + 10, y + h);
                    ctx.quadraticCurveTo(x, y + h, x, y + h - 10);
                    ctx.lineTo(x, y + 10);
                    ctx.quadraticCurveTo(x, y, x + 10, y);
                    ctx.closePath();

                    ctx.fillStyle = "#fff";
                    ctx.shadowColor = "rgba(0,0,0,.2)";
                    ctx.shadowBlur  = 10;
                    ctx.fill();
                    ctx.shadowColor = "transparent";

                    ctx.font = "16px Arial";
                    ctx.textAlign = "center";
                    ctx.fillStyle = "#000";
                    ctx.fillText(`${info.country}`,
                        width / 2, y + 34);
                }
            }

            /* ==========[ 한 나라 이동 애니메이션 ]========== */
            function animateCountry(country) {
                return new Promise(res => {
                    const info = sorted.find(v => v.country === country.properties.name);

                    p1 = p2;                      // 이전 중심
                    if (country.properties.name === "France") {
                        // 파리: 경도 2.3522, 위도 48.8566
                        p2 = [2.3522, 48.8566];
                    } else {
                        p2 = d3.geoCentroid(country);
                    } // 새로운 중심
                    r1 = r2;
                    r2 = [-p2[0], tilt - p2[1], 0];

                    const ip = d3.geoInterpolate(p1, p2);
                    const iv = Versor.interpolateAngles(r1, r2);

                    /* 1) 회전 */
                    d3.transition("rotate")
                        .duration(3000)
                        .tween("t", () => t => {
                            projection.rotate(iv(t));
                            render(country,
                                { type: "LineString", coordinates: [p1, ip(t)] },
                                true);
                        })
                        .on("end", () => {
                            /* 2) 호 줄이기 */
                            d3.transition("fade")
                                .duration(2000)
                                .tween("t2", () => t => {
                                    render(country,
                                        { type: "LineString", coordinates: [ip(t), p2] },
                                        true, info);
                                })
                                .on("end", () => {
                                    projection.rotate(iv(1)); // 최종 각도 고정
                                    res();                    // 다음 국가로
                                });
                        });
                });
            }

            /* ==========[ 국가 순환 루프 ]========== */
            function startTour() {
                let idx = 0;

                function next() {
                    animateCountry(visitCountries[idx])
                        .then(() => {
                            idx = (idx + 1) % visitCountries.length;
                            next();
                        });
                }
                next();
            }

            /* ==========------[  리셋 함수 등록  ]------========== */
            resetRef.current = () => {
                /* 1) 모든 ongoing transition 중단 */
                canvas.interrupt();          // canvas에 묶인 transition들
                d3.selectAll("*").interrupt(); // (혹시 모를) 잔여 transition

                /* 2) 상태 변수 리셋 */
                p1 = [0, 0]; p2 = [0, 0];
                r1 = [0, 0, 0]; r2 = [0, 0, 0];

                /* 3) 투영각 초기화 후 다시 시작 */
                projection.rotate([0, 0]);
                startTour();
            };

            /* 최초 1회 시작 */
            startTour();
        });

        /* ==========[ 언마운트 시 클린업 ]========== */
        return () => {
            canvas.interrupt();
            d3.selectAll("*").interrupt();
        };
    }, []);

    /* 버튼 하나 추가해 resetRef.current() 호출 */
    return (
        <>
            <canvas ref={canvasRef} />
        </>
    );
};

export default WorldMap;