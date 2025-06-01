import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { saveSvgAsPng } from "save-svg-as-png";

// 시·도 코드 → 한글 이름
const codePrefixToProvince = {
    "11": "서울특별시", "21": "부산광역시", "22": "대구광역시", "23": "인천광역시",
    "24": "광주광역시", "25": "대전광역시", "26": "울산광역시", "29": "세종특별자치시",
    "31": "경기도", "32": "강원특별자치도", "33": "충청북도", "34": "충청남도",
    "35": "전라북도", "36": "전라남도", "37": "경상북도", "38": "경상남도", "39": "제주특별자치도"
};
// “서울” → “서울특별시”
const shortToLong = {
    서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시",
    광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
    경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도",
    전북: "전라북도", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도", 제주: "제주특별자치도"
};

const SEASONS = ["봄", "여름", "가을", "겨울"];


function SeasonalWindmap({ data, topo }) {
    const svgRef = useRef(null);
    const [season, setSeason] = useState("봄");

    function handleDownload() {
        const svgElement = svgRef.current;
        if (!svgElement) return;
        saveSvgAsPng(svgElement, `korea-season-windmap-${season}.png`, {
            backgroundColor: "#ffffff",
            scale: 2,
        });
    }

    useEffect(() => {
        const width = 1300, height = 900;

        d3.selectAll(".korea-map-tooltip").remove();  // 기존 툴팁 삭제

        const svg = d3.select(svgRef.current)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("width", "800px")
            .style("height", "auto")
            .style("background", "#f9f9f9")
            .style("border-radius", "12px")
            .style("box-shadow", "0 4px 12px rgba(0,0,0,0.1)");

        svg.selectAll("*").remove();

        // ---- 이하 동일 ----
        const seasonMap = { 봄: [3, 4, 5], 여름: [6, 7, 8], 가을: [9, 10, 11], 겨울: [12, 1, 2] };
        const rowsRaw = data.map(d => {
            const date = new Date(d["일시"]);
            const month = date.getMonth() + 1;
            if (!seasonMap[season].includes(month)) return null;

            const [abbr] = d["지역"].trim().split(" ");
            const province = shortToLong[abbr] || abbr;
            return {
                province,
                windSpeed: +d["최대 풍속(m/s)"],
                windDir: +d["최대 풍속 풍향(16방위)"]
            };
        });
        const rows = rowsRaw.filter(d => d && d.province && !isNaN(d.windSpeed) && !isNaN(d.windDir));

        const provinceWind = d3.rollups(
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
        );
        const windMap = new Map(provinceWind);

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

        const color = d3.scaleThreshold()
            .domain([5, 10, 15, 20, 30])
            .range(["#cceeff", "#3399ff", "#ffcc00", "#ff9933", "#ff3300", "#9900cc"]);

        const projection = d3.geoMercator().fitSize([width, height], {
            type: "FeatureCollection",
            features: provinces
        });
        const path = d3.geoPath().projection(projection);

        // Tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "korea-map-tooltip")
            .style("position", "absolute")
            .style("background", "#fff")
            .style("padding", "6px 10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
            .style("opacity", 0);

        svg.append("text")
            .attr("x", width * 4 / 5)
            .attr("y", 60)
            .attr("text-anchor", "middle")
            .attr("font-size", "3rem")
            .attr("font-weight", 700)
            .attr("fill", "#222")
            .attr("class", "season-label")
            .text(season);

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
                tooltip.html(
                    `<strong>${d.properties.province}</strong><br/>
                     평균 풍속: ${wind?.avgSpeed?.toFixed(1) ?? "N/A"} m/s<br/>
                     최빈 풍향: ${wind?.avgDir?.toFixed(0) ?? "N/A"}°`
                ).style("opacity", 1);
            })
            .on("mousemove", e => {
                tooltip.style("left", `${e.pageX + 10}px`).style("top", `${e.pageY - 28}px`);
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke", "#999").attr("stroke-width", 0.6);
                tooltip.style("opacity", 0);
            });

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

        g.selectAll("line.wind")
            .data(provinces)
            .enter()
            .append("line")
            .attr("class", "wind")
            .attr("x1", d => path.centroid(d)[0])
            .attr("y1", d => path.centroid(d)[1])
            .attr("x2", d => {
                const wind = windMap.get(d.properties.province);
                const angle = wind?.avgDir ?? 0;
                return path.centroid(d)[0] + 10 * Math.sin((angle * Math.PI) / 180);
            })
            .attr("y2", d => {
                const wind = windMap.get(d.properties.province);
                const angle = wind?.avgDir ?? 0;
                return path.centroid(d)[1] - 10 * Math.cos((angle * Math.PI) / 180);
            })
            .attr("stroke", "#333")
            .attr("stroke-width", 2)
            .attr("marker-end", "url(#arrow)");

        svg.append("defs").append("marker")
            .attr("id", "arrow")
            .attr("viewBox", "0 0 10 10")
            .attr("refX", 5)
            .attr("refY", 5)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto-start-reverse")
            .append("path")
            .attr("d", "M 0 0 L 10 5 L 0 10 z")
            .attr("fill", "#333");
    }, [data, season, topo]);  // <--- topo도 꼭 의존성에 포함

    return (
        <div>
            <div style={{ marginBottom: "1rem", textAlign: "center" }}>
                {SEASONS.map(s => (
                    <button
                        key={s}
                        onClick={() => setSeason(s)}
                        style={{
                            marginRight: "8px",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            background: season === s ? "#333" : "#eee",
                            color: season === s ? "#fff" : "#000",
                            border: "none",
                            cursor: "pointer"
                        }}
                    >
                        {s}
                    </button>
                ))}
            </div>
            <svg
                ref={svgRef}
                width="100%"
                viewBox="0 0 1300 900"    // <-- 여기도 수정
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
                    현재 계절 히트맵 다운로드
                </button>
            </div>
        </div>
    );
}

export default SeasonalWindmap;