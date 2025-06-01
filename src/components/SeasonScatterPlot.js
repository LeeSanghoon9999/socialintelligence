import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const SEASONS = ["봄", "여름", "가을", "겨울"];
const SEASON_COLOR = d3.scaleOrdinal()
    .domain(SEASONS)
    .range(["#4e79a7", "#f28e2b", "#76b7b2", "#e15759"]);

function getSeason(month) {
    if ([3, 4, 5].includes(month)) return "봄";
    if ([6, 7, 8].includes(month)) return "여름";
    if ([9, 10, 11].includes(month)) return "가을";
    return "겨울";
}

const SeasonScatterPlot = () => {
    const ref = useRef();
    const [data, setData] = useState([]);

    useEffect(() => {
        d3.csv("/data/preprocessed_data.csv", d => {
            // "일시" 필드가 없는 경우 필터
            if (!d["일시"]) return null;
            const m = +d["일시"].slice(5, 7);
            return {
                계절: getSeason(m),
                PM10: +d["PM10"],
                강수량: +d["일강수량(mm)"],
                풍속: +d["최대 풍속(m/s)"],
            };
        }).then(raw => {
            setData(
                (raw || []).filter(d =>
                    d &&
                    SEASONS.includes(d.계절) &&
                    !isNaN(d.PM10) &&
                    !isNaN(d.강수량) &&
                    !isNaN(d.풍속)
                )
            );
        });
    }, []);

    useEffect(() => {
        if (data.length === 0) return;

        const variables = ["PM10", "강수량", "풍속"];
        const size = 180;
        const padding = 40;
        const n = variables.length;
        const width = size * n;
        const height = size * n;

        const svg = d3.select(ref.current)
            .attr("width", width + padding)
            .attr("height", height + padding)
            .attr("viewBox", [0, 0, width + padding, height + padding])
            .style("font-family", "Segoe UI, sans-serif")
            .style("font-size", "12px");

        svg.selectAll("*").remove();

        const x = {}, y = {};
        variables.forEach(key => {
            const extent = d3.extent(data, d => d[key]);
            x[key] = d3.scaleLinear().domain(extent).nice().range([padding / 2, size - padding / 2]);
            y[key] = d3.scaleLinear().domain(extent).nice().range([size - padding / 2, padding / 2]);
        });

        const cell = svg.append("g")
            .selectAll("g")
            .data(d3.cross(variables, variables))
            .join("g")
            .attr("transform", ([xVar, yVar]) =>
                `translate(${variables.indexOf(xVar) * size},${variables.indexOf(yVar) * size})`
            );

        cell.append("rect")
            .attr("fill", "#f9f9f9")
            .attr("stroke", "#ddd")
            .attr("x", padding / 2)
            .attr("y", padding / 2)
            .attr("width", size - padding)
            .attr("height", size - padding)
            .attr("rx", 6);

        cell.each(function ([xVar, yVar]) {
            const group = d3.select(this);

            group.append("g")
                .attr("transform", `translate(0,${size - padding / 2})`)
                .call(d3.axisBottom(x[xVar]).ticks(3).tickSize(-(size - padding)).tickFormat(""))
                .call(g => g.selectAll("line").attr("stroke", "#eee"));

            group.append("g")
                .attr("transform", `translate(${padding / 2},0)`)
                .call(d3.axisLeft(y[yVar]).ticks(3).tickSize(-(size - padding)).tickFormat(""))
                .call(g => g.selectAll("line").attr("stroke", "#eee"));

            group.selectAll("circle")
                .data(data.filter(d => !isNaN(d[xVar]) && !isNaN(d[yVar])))
                .join("circle")
                .attr("cx", d => x[xVar](d[xVar]))
                .attr("cy", d => y[yVar](d[yVar]))
                .attr("r", 2.5)
                .attr("fill", d => SEASON_COLOR(d.계절))
                .attr("fill-opacity", 0.6);
        });

        svg.append("g")
            .selectAll("text")
            .data(variables)
            .join("text")
            .attr("x", (d, i) => i * size + padding / 1.5)
            .attr("y", (d, i) => i * size + padding / 1.5)
            .attr("font-size", "13px")
            .attr("font-weight", "600")
            .text(d => d);

        // 계절별 범례
        const legend = svg.append("g")
            .attr("transform", `translate(${width - 100}, ${height - 30})`);

        SEASONS.forEach((season, i) => {
            legend.append("circle")
                .attr("cx", 0)
                .attr("cy", i * 20)
                .attr("r", 6)
                .attr("fill", SEASON_COLOR(season));

            legend.append("text")
                .attr("x", 12)
                .attr("y", i * 20 + 4)
                .text(season)
                .style("font-size", "12px")
                .attr("fill", "#333");
        });
    }, [data]);

    return (
        <div style={{
            maxWidth: "1000px",
            margin: "0 auto",
            background: "#ffffff",
            padding: "30px",
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)"
        }}>
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
                계절별 PM10 PairPlot
            </h2>
            <svg ref={ref}></svg>
        </div>
    );
};

export default SeasonScatterPlot;