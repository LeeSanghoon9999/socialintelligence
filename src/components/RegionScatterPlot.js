import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const RegionScatterPlot = () => {
    const ref = useRef();
    const [data, setData] = useState([]);

    useEffect(() => {
        d3.csv("/data/preprocessed_data.csv", d => ({
            발전소: +d["발전소"],
            PM10: +d["PM10"],
            평균기온: +d["평균기온(°C)"],
            자동차수: +d["일별등록대수"],
        })).then(raw => {
            setData(raw);
        });
    }, []);

    useEffect(() => {
        if (data.length === 0) return;

        const svg = d3.select(ref.current);
        svg.selectAll("*").remove();

        const variables = [
            "PM10", "평균기온", "자동차수"
        ];

        const size = 180;
        const padding = 40;
        const n = variables.length;
        const width = size * n;
        const height = size * n;

        const x = {}, y = {};
        variables.forEach(key => {
            const extent = d3.extent(data, d => d[key]);
            x[key] = d3.scaleLinear().domain(extent).nice().range([padding / 2, size - padding / 2]);
            y[key] = d3.scaleLinear().domain(extent).nice().range([size - padding / 2, padding / 2]);
        });

        const color = d3.scaleOrdinal()
            .domain([0, 1])
            .range(["#4e79a7", "#e15759"]);

        const chart = svg
            .attr("viewBox", [0, 0, width + padding, height + padding])
            .style("font-family", "Segoe UI, sans-serif")
            .style("font-size", "12px");

        const cell = chart.append("g")
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
                .attr("fill", d => color(d["발전소"]))
                .attr("fill-opacity", 0.6);
        });

        chart.append("g")
            .selectAll("text")
            .data(variables)
            .join("text")
            .attr("x", (d, i) => i * size + padding / 1.5)
            .attr("y", (d, i) => i * size + padding / 1.5)
            .attr("font-size", "13px")
            .attr("font-weight", "600")
            .text(d => d);

        const legend = svg.append("g")
            .attr("transform", `translate(${width - 100}, ${height + 10})`);

        ["비발전소 지역", "발전소 지역"].forEach((label, i) => {
            legend.append("circle")
                .attr("cx", 0)
                .attr("cy", i * 20)
                .attr("r", 6)
                .attr("fill", color(i));

            legend.append("text")
                .attr("x", 12)
                .attr("y", i * 20 + 4)
                .text(label)
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
                발전소 vs 비발전소 PM10 PairPlot
            </h2>
            <svg ref={ref} width="100%" height={400}></svg>
        </div>
    );
};

export default RegionScatterPlot;