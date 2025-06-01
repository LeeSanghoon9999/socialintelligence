import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// 계절 구분
const getSeason = (date) => {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    if ((m === 3 && d >= 1) || (m > 3 && m < 5) || (m === 5 && d <= 30)) return "봄";
    if ((m === 5 && d >= 31) || (m > 5 && m < 9) || (m === 9 && d <= 25)) return "여름";
    if ((m === 9 && d >= 26) || (m > 9 && m < 12) || (m === 12 && d <= 3)) return "가을";
    return "겨울";
};

// (useState, useEffect 선언부 위에는 그대로)
const SeoulSeasonHeatmap = () => {
    const heatmapRef = useRef();
    const sunburstRef = useRef();
    // grouped(heatmap), filtered(sunburst), flat(heatmap), maxPM10(공통)
    const [chartData, setChartData] = useState({
        grouped: [],
        filtered: [],
        flat: [],
        maxPM10: 0,
    });

    useEffect(() => {
        d3.csv("/data/preprocessed_data.csv", d => ({
            지역: d["지역"],
            일자: new Date(d["일시"]),
            PM10: +d["PM10"]
        })).then(raw => {
            const filtered = raw
                .filter(d => d.지역 === "서울 중구")
                .map(d => {
                    const season = getSeason(d.일자);
                    return {
                        연도: d.일자.getFullYear(),
                        계절: season,
                        PM10: d.PM10
                    };
                })


            const grouped = Array.from(
                d3.group(filtered, d => d.연도),
                ([year, rows]) => ({
                    연도: year,
                    ...Object.fromEntries(
                        d3.rollup(rows, v => d3.mean(v, d => d.PM10), d => d.계절)
                    )
                })
            );

            const seasons = ["봄","여름", "가을", "겨울"];
            const flat = grouped.flatMap(d =>
                seasons.map(s => ({
                    연도: d.연도,
                    계절: s,
                    PM10: d[s]
                }))
            );

            const allValues = [
                ...flat.map(d => d.PM10),
                ...grouped.map(d => {
                    // 연 평균값
                    const vals = seasons.map(s => d[s]).filter(v => typeof v === "number");
                    return vals.length ? d3.mean(vals) : null;
                }).filter(v => v !== null)
            ];
            const minPM10 = d3.min(allValues);
            const maxPM10 = d3.max(allValues);

            setChartData({ grouped, filtered, flat, minPM10, maxPM10 });
        });
    }, []);

    // Heatmap
    useEffect(() => {
        if (!chartData.flat.length || !chartData.maxPM10) return;

        const margin = { top: 50, right: 30, bottom: 30, left: 60 };
        const width = 600 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = d3.select(heatmapRef.current);
        svg.selectAll("*").remove();

        const g = svg
            .attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const years = chartData.grouped.map(d => d.연도).sort();
        const seasons = ["봄","여름", "가을", "겨울"];
        const flat = chartData.flat;

        const x = d3.scaleBand().domain(seasons).range([0, width]).padding(0.1);
        const y = d3.scaleBand().domain(years).range([0, height]).padding(0.1);

        // ⬇️ 공통 color scale!
        const color = d3.scaleSequential(d3.interpolatePuBuGn)
            .domain([0, chartData.maxPM10]);

        g.append("g")
            .selectAll("rect")
            .data(flat)
            .join("rect")
            .attr("x", d => x(d.계절))
            .attr("y", d => y(d.연도))
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .attr("fill", d => d.PM10 ? color(d.PM10) : "#eee")
            .attr("rx", 6);

        g.append("g")
            .call(d3.axisLeft(y).tickSize(0))
            .selectAll("text").attr("font-size", "12px");

        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickSize(0))
            .selectAll("text").attr("font-size", "12px");

        g.selectAll("text.label")
            .data(flat)
            .join("text")
            .attr("x", d => x(d.계절) + x.bandwidth() / 2)
            .attr("y", d => y(d.연도) + y.bandwidth() / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", d => d.PM10 > 60 ? "#fff" : "#333")
            .attr("font-size", "11px")
            .text(d => d.PM10 ? d.PM10.toFixed(1) : "-");
    }, [chartData]);

    // Sunburst 렌더링
    useEffect(() => {
        if (!chartData.filtered.length || !chartData.maxPM10) return;

        const buildHierarchy = (data) => {
            const groupedByYear = d3.groups(data, d => d.연도);

            return {
                name: "서울 중구",
                children: groupedByYear.map(([year, rows]) => {
                    const seasonMeans = d3.rollup(
                        rows,
                        v => d3.mean(v, d => d.PM10),
                        d => d.계절
                    );
                    const children = Array.from(seasonMeans, ([season, avg]) => ({
                        name: season,
                        value: Math.round(avg)
                    }));
                    // 부모 value도 평균을 기록!
                    const yearMean = d3.mean(rows, d => d.PM10);
                    return {
                        name: String(year),
                        value: Math.round(yearMean), // 이 value는 arc 색상용, sum에는 사용하지 않음!
                        children
                    };
                })
            };
        };

        const width = 932;
        const radius = width / 6;
        const colorScale = d3.scaleSequential(d3.interpolatePuBuGn)
            .domain([chartData.minPM10, chartData.maxPM10]);


        const hierarchy = d3.hierarchy(buildHierarchy(chartData.filtered))
            .sum(d => d.children ? 0 : d.value) // LEAF(계절)만 합산
            .sort((a, b) => (b.data.value ?? 0) - (a.data.value ?? 0));

        const root = d3.partition().size([2 * Math.PI, hierarchy.height + 1])(hierarchy);
        root.each(d => d.current = d);

        const svg = d3.select(sunburstRef.current);
        svg.selectAll("*").remove();
        svg.attr("viewBox", [-width / 2, -width / 2, width, width]).style("font", "12px sans-serif");

        const arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
            .padRadius(radius * 1.5)
            .innerRadius(d => d.y0 * radius)
            .outerRadius(d => d.y1 * radius - 1);

        const g = svg.append("g");


        const path = g.selectAll("path")
            .data(root.descendants().slice(1))
            .join("path")
            .attr("fill", d => {
                // value가 없으면 부모 → 그 부모의 value로 색상(=연 평균)
                const v = d.data.value;
                return typeof v === "number" ? colorScale(v) : "#ccc";
            })
            .attr("fill-opacity", d => arcVisible(d.current) ? 0.85 : 0)
            .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
            .attr("d", d => arc(d.current));

        path.append("title")
            .text(d => `${d.ancestors().map(d => d.data.name).reverse().join(" / ")}\nPM10: ${Math.round(d.value)}`);

        path.filter(d => d.children).style("cursor", "pointer").on("click", clicked);

        const label = g.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .style("user-select", "none")
            .selectAll("text")
            .data(root.descendants().slice(1))
            .join("text")
            .attr("dy", "0.35em")
            .attr("fill-opacity", d => +labelVisible(d.current))
            .attr("transform", d => labelTransform(d.current))
            .each(function(d) {
                d3.select(this).selectAll("*").remove();
                if (d.depth === 2) {
                    d3.select(this)
                        .append("tspan")
                        .attr("x", 0)
                        .attr("dy", 0)
                        .text(d.data.name);
                    d3.select(this)
                        .append("tspan")
                        .attr("x", 0)
                        .attr("dy", "1.2em")
                        .text(d.data.value);
                } else if (d.depth === 1) {
                    d3.select(this)
                        .append("tspan")
                        .attr("x", 0)
                        .attr("dy", 0)
                        .text(d.data.name);
                    d3.select(this)
                        .append("tspan")
                        .attr("x", 0)
                        .attr("dy", "1.2em")
                        .text(d.data.value); // 연 평균도 출력!
                }
            });

        const parent = svg.append("circle")
            .datum(root)
            .attr("r", radius)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("click", clicked);

        function clicked(event, p) {
            parent.datum(p.parent || root);
            root.each(d => {
                d.target = {
                    x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                    x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                    y0: Math.max(0, d.y0 - p.depth),
                    y1: Math.max(0, d.y1 - p.depth)
                };
            });

            const t = svg.transition().duration(event.altKey ? 7500 : 750);
            path.transition(t)
                .tween("data", d => {
                    const i = d3.interpolate(d.current, d.target);
                    return t => d.current = i(t);
                })
                .attrTween("d", d => () => arc(d.current))
                .attr("fill-opacity", d => arcVisible(d.target) ? 0.85 : 0);

            label.transition(t)
                .attr("fill-opacity", d => +labelVisible(d.target))
                .attrTween("transform", d => () => labelTransform(d.current));
        }

        function arcVisible(d) {
            return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
        }
        function labelVisible(d) {
            return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
        }
        function labelTransform(d) {
            const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
            const y = (d.y0 + d.y1) / 2 * radius;
            return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        }
    }, [chartData]);

    return (
        <div
            style={{
                maxWidth: "1400px",
                margin: "0 auto",
                padding: "30px",
            }}
        >
            <h3 style={{ textAlign: "center", marginBottom: "18px" }}>
                서울 중구 PM10 히트맵 & 연도/계절 Sunburst
            </h3>
            {/* 가로 flex 컨테이너 */}
            <div
                style={{
                    display: "flex",
                    gap: "2vw",
                    flexWrap: "wrap",
                    justifyContent: "center",
                }}
            >
                <div style={{
                    flex: "1 1 0",
                    minWidth: "320px",
                    maxWidth: "620px",
                    height: "480px",
                    background: "#fff",
                    borderRadius: "14px",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "18px"
                }}>
                    <svg ref={heatmapRef} width="100%" height="100%" style={{ minHeight: 400, minWidth: 320 }}/>
                </div>
                <div style={{
                    flex: "1 1 0",
                    minWidth: "400px",
                    maxWidth: "800px",
                    height: "480px",
                    background: "#fff",
                    borderRadius: "14px",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "18px"
                }}>
                    <svg ref={sunburstRef} width="100%" height="100%" style={{ minHeight: 400, minWidth: 400 }}/>
                </div>
            </div>
        </div>
    );
};

export default SeoulSeasonHeatmap;