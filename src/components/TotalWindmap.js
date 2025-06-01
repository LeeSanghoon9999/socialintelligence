import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { saveSvgAsPng } from "save-svg-as-png";

const codePrefixToProvince = {
    "11": "서울특별시", "21": "부산광역시", "22": "대구광역시", "23": "인천광역시",
    "24": "광주광역시", "25": "대전광역시", "26": "울산광역시", "29": "세종특별자치시",
    "31": "경기도", "32": "강원특별자치도", "33": "충청북도", "34": "충청남도",
    "35": "전라북도", "36": "전라남도", "37": "경상북도", "38": "경상남도", "39": "제주특별자치도"
};

const shortToLong = {
    서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시",
    광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
    경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도",
    전북: "전라북도", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도", 제주: "제주특별자치도"
};

const YEARS = ["전체", "21년", "22년", "23년"];

function TotalWindmap({ data, topo }) {
    const svgRef = useRef(null);
    const [year, setYear] = useState("전체");

    function handleDownload() {
        const svgElement = svgRef.current;
        if (!svgElement) return;
        saveSvgAsPng(svgElement, `korea-year-windmap-${year}.png`, {
            backgroundColor: "#ffffff",
            scale: 2,
        });
    }

    useEffect(() => {
        const width = 1300;
        const height = 900;

        const svg = d3
            .select(svgRef.current)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("width", "800px")
            .style("height", "80%")
            .style("background", "#f9f9f9")
            .style("border-radius", "12px")
            .style("box-shadow", "0 4px 12px rgba(0,0,0,0.1)");
        svg.selectAll("*").remove();

        const yearMap = { 전체: [], "21년": [2021], "22년": [2022], "23년": [2023] };

        // 1. 데이터 가공 및 필터
        const rowsRaw = data.map(d => {
            const date = new Date(d["일시"]);
            const dataYear = date.getFullYear();

            if (year !== "전체" && !yearMap[year].includes(dataYear)) return null;

            const [abbr] = d["지역"].trim().split(" ");
            const province = shortToLong[abbr] || abbr;
            return {
                province,
                value: +d["최대 풍속(m/s)"]
            };
        });

        // 2. 유효 행만 남기기
        const rows = rowsRaw.filter(
            d =>  d && d.province && !isNaN(d.value)
        );
        const provinceAvg = d3.rollup(
            rows,
            (v) => d3.mean(v, (d) => d.value),
            (d) => d.province,
        );

        const windMap = new Map(
            d3.rollups(
                rows,
                v => {
                    const avgSpeed = d3.mean(v, d => d.windSpeed);
                    const toRad = deg => (deg * Math.PI) / 180;
                    const weightSum = d3.sum(v, d => d.windSpeed) || 1;
                    const cosMean = d3.sum(v, d => Math.cos(toRad(d.windDir)) * d.windSpeed) / weightSum;
                    const sinMean = d3.sum(v, d => Math.sin(toRad(d.windDir)) * d.windSpeed) / weightSum;
                    let dir = Math.atan2(sinMean, cosMean) * 180 / Math.PI;
                    if (dir < 0) dir += 360;
                    return { avgSpeed, avgDir: dir };
                },
                d => d.province
            )
        );

        const values = Array.from(windMap.values()).map(d => d.avgSpeed);

        // 4. 지도 데이터 파싱
        const topoKey = Object.keys(topo.objects)[0];
        const geo = topojson.feature(topo, topo.objects[topoKey]);
        const grouped = d3.group(geo.features, f => f.properties.code.slice(0, 2));
        const provinces = Array.from(grouped, ([codePrefix, feats]) => {
            const coords = [];
            feats.forEach(f => {
                if (f.geometry.type === "Polygon") coords.push(f.geometry.coordinates);
                else if (f.geometry.type === "MultiPolygon") coords.push(...f.geometry.coordinates);
            });
            return {
                type: "Feature",
                properties: {
                    codePrefix,
                    province: codePrefixToProvince[codePrefix]
                },
                geometry: { type: "MultiPolygon", coordinates: coords }
            };
        });

        // 5. 색상 스케일
        const color = d3.scaleThreshold()
            .domain([5, 10, 15, 20, 30])
            .range([
                "#cceeff", // <5
                "#3399ff", // 5–10
                "#ffcc00", // 10–15
                "#ff9933", // 15–20
                "#ff3300", // 20–30
                "#9900cc"  // >30
            ]);

        // 6. 지도 투영
        const projection = d3.geoMercator().fitSize([width, height], {
            type: "FeatureCollection", features: provinces
        });
        const path = d3.geoPath().projection(projection);

        // 7. Tooltip 준비
        const tooltip = d3.select("body").append("div")
            .style("position", "absolute")
            .style("background", "#fff")
            .style("padding", "6px 10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
            .style("opacity", 0);

        // 8. 지도 그리기
        const g = svg.append("g");

        g.selectAll("path")
            .data(provinces)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("fill", d => {
                const wind = windMap.get(d.properties.province);
                return wind ? color(wind.avgSpeed) : "#eee";
            })
            .attr("stroke", "#999")
            .attr("stroke-width", 0.6)
            .on("mouseover", function (e, d) {
                const wind = windMap.get(d.properties.province);
                d3.select(this).attr("stroke", "#333").attr("stroke-width", 1.5);
                tooltip
                    .html(`<strong>${d.properties.province}</strong><br/>
                        평균 풍속: ${wind?.avgSpeed?.toFixed(1) ?? "N/A"} m/s<br/>
                        평균 풍향: ${wind?.avgDir?.toFixed(0) ?? "N/A"}°`)
                    .style("opacity", 1);
            })
            .on("mousemove", e => {
                tooltip
                    .style("left", `${e.pageX + 10}px`)
                    .style("top", `${e.pageY - 28}px`);
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke", "#999").attr("stroke-width", 0.6);
                tooltip.style("opacity", 0);
            });

        // 9. 텍스트 풍속 레이블
        g.selectAll("text.wind-label")
            .data(provinces)
            .enter()
            .append("text")
            .attr("class", "wind-label")
            .attr("transform", d => `translate(${path.centroid(d)})`)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("fill", "#333")
            .text(d => {
                const wind = windMap.get(d.properties.province);
                return wind ? `${wind.avgSpeed.toFixed(1)} m/s` : "";
            });

        // 10. cleanup: Tooltip 여러번 생성 방지
        return () => {
            d3.selectAll("body > div").remove();
        };
    }, [year, data, topo]);

    return (
        <div>
            <div style={{ marginBottom: "1rem", textAlign: "center" }}>
                {YEARS.map(s => (
                    <button
                        key={s}
                        onClick={() => setYear(s)}
                        style={{
                            marginRight: "8px",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            background: year === s ? "#333" : "#eee",
                            color: year === s ? "#fff" : "#000",
                            border: "none",
                            cursor: "pointer",
                        }}>
                        {s}
                    </button>
                ))}
            </div>
            <svg
                ref={svgRef}
                width="100%"
                viewBox="0 0 960 600"
                preserveAspectRatio="xMidYMid meet"
                style={{ height: "auto", maxWidth: "100%" }}
            />
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <button
                    onClick={handleDownload}
                    style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        background: "#007bff",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer"
                    }}
                >
                    현재 연도별 히트맵 다운로드
                </button>
            </div>
        </div>
    );
}

export default TotalWindmap;