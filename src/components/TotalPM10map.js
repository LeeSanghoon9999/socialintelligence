import React, {useEffect, useRef, useState} from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import {saveSvgAsPng} from "save-svg-as-png";


/* ───────── 행정코드 2자리 → 공식 시·도명 ───────── */
const codePrefixToProvince = {
    "11": "서울특별시",
    "21": "부산광역시",
    "22": "대구광역시",
    "23": "인천광역시",
    "24": "광주광역시",
    "25": "대전광역시",
    "26": "울산광역시",
    "29": "세종특별자치시",
    "31": "경기도",
    "32": "강원특별자치도",
    "33": "충청북도",
    "34": "충청남도",
    "35": "전라북도",
    "36": "전라남도",
    "37": "경상북도",
    "38": "경상남도",
    "39": "제주특별자치도",
};

/* ───────── CSV에 나타나는 축약 표기 → 공식 시·도명 ───────── */
const shortToLong = {
    서울: "서울특별시",
    부산: "부산광역시",
    대구: "대구광역시",
    인천: "인천광역시",
    광주: "광주광역시",
    대전: "대전광역시",
    울산: "울산광역시",
    세종: "세종특별자치시",
    경기: "경기도",
    강원: "강원특별자치도",
    충북: "충청북도",
    충남: "충청남도",
    전북: "전라북도",
    전남: "전라남도",
    경북: "경상북도",
    경남: "경상남도",
    제주: "제주특별자치도",
};

const YEARS = ["전체", "21년", "22년", "23년"];

function TotalPM10map({data, topo}) {
    const svgRef = useRef(null);
    const [year, setYear] = useState("전체");   // ← 1. state 이름 변경

    function handleDownload() {
        const svgElement = svgRef.current;
        if (!svgElement) return;
        saveSvgAsPng(svgElement, `korea-year-pm10map-${year}.png`, {
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
            .style("width", "800")
            .style("height", "80%")
            .style("background", "#f9f9f9")
            .style("border-radius", "12px")
            .style("box-shadow", "0 4px 12px rgba(0,0,0,0.1)");

        svg.selectAll("*").remove();

        const yearMap = { 전체: [], "21년": [2021], "22년": [2022], "23년": [2023] };  // ← 2. 오타 수정, 연도 매핑

        const rowsRaw = data.map(d => {
            const date = new Date(d["일시"]);
            const dataYear = date.getFullYear();

            // yearMap에서 연도 필터 처리
            if (year !== "전체" && !yearMap[year].includes(dataYear)) return null;

            const [abbr] = d["지역"].trim().split(" ");
            const province = shortToLong[abbr] || abbr;
            return {
                province,
                value: +d["PM10"]
            };
        });

        const rows = rowsRaw.filter((d) => d && d.province && !isNaN(d.value));
        const provinceAvg = d3.rollup(
            rows,
            (v) => d3.mean(v, (d) => d.value),
            (d) => d.province,
        );

        const values = Array.from(provinceAvg.values());

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
        const color = d3
                    .scaleQuantize()
                    .domain(values.length ? d3.extent(values) : [0, 100])
                    .range(d3.schemeOranges[7]);

                // 투영 & path
                const projection = d3.geoMercator().fitSize(
                    [width, height],
                    { type: "FeatureCollection", features: provinces },
                );
                const path = d3.geoPath().projection(projection);

                // Tooltip
                const tooltip = d3
                    .select("body")
                    .append("div")
                    .style("position", "absolute")
                    .style("background", "#fff")
                    .style("padding", "6px 10px")
                    .style("border", "1px solid #ccc")
                    .style("border-radius", "4px")
                    .style("pointer-events", "none")
                    .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
                    .style("opacity", 0);

                // 지도 그리기
                const g = svg.append("g");

                g.selectAll("path")
                    .data(provinces)
                    .enter()
                    .append("path")
                    .attr("d", path)
                    .attr("fill", (d) => {
                        const v = provinceAvg.get(d.properties.province);
                        return v != null ? color(v) : "#eee";
                    })
                    .attr("stroke", "#aaa")
                    .attr("stroke-width", 0.7)
                    .on("mouseover", function (e, d) {
                        const v = provinceAvg.get(d.properties.province);
                        d3.select(this).attr("stroke", "#333").attr("stroke-width", 1.8);
                        tooltip
                            .html(
                                `<strong>${d.properties.province}</strong><br/>PM10: ${
                                    v != null ? v.toFixed(1) + " µg/m³" : "N/A"
                                }`,
                            )
                            .style("opacity", 1);
                    })
                    .on("mousemove", (e) => {
                        tooltip
                            .style("left", `${e.pageX + 10}px`)
                            .style("top", `${e.pageY - 28}px`);
                    })
                    .on("mouseout", function () {
                        d3.select(this).attr("stroke", "#aaa").attr("stroke-width", 0.7);
                        tooltip.style("opacity", 0);
                    });

                // 전체 시·도에 라벨
                g.selectAll("text")
                    .data(provinces)
                    .enter()
                    .append("text")
                    .attr("transform", (d) => `translate(${path.centroid(d)})`)
                    .attr("dy", "-0.5em")
                    .attr("text-anchor", "middle")
                    .style("font-size", "14px")
                    .style("font-weight", "bold")
                    .style("fill", "#333")
                    .text((d) => {
                        const v = provinceAvg.get(d.properties.province);
                        return v != null ? `${v.toFixed(1)} µg/m³` : "";
                    });
            }, [year, data, topo]);

    return (
        <div>
            <div style={{ marginBottom: "1rem", textAlign: "center" }}>
                {['전체', '21년', '22년', '23년'].map(s => (
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

export default TotalPM10map;