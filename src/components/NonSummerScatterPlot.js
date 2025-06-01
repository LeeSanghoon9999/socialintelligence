import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const NonSummerScatterPlot = () => {
    const ref = useRef();
    const [data, setData] = useState([]);

    const getSeason = (date) => {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        if ((month === 3 && day >= 1) || (month > 3 && month < 5) || (month === 5 && day <= 30)) return "봄";
        if ((month === 5 && day >= 31) || (month > 5 && month < 9) || (month === 9 && day <= 25)) return "여름";
        if ((month === 9 && day >= 26) || (month > 9 && month < 12) || (month === 12 && day <= 3)) return "가을";
        return "겨울";
    };

    useEffect(() => {
        d3.csv("/data/filtered_merged.csv", d => ({
            지역: d["지역"],
            일자: new Date(d["일자"]),
            PM10: +d["PM10"]
        })).then(raw => {
            raw.forEach(d => {
                d.계절 = getSeason(d.일자);
            });

            const filtered = raw.filter(d => ["봄", "가을", "겨울"].includes(d.계절));

            const grouped = d3.rollup(
                filtered,
                v => d3.mean(v, d => d.PM10),
                d => d.지역,
                d => d3.timeFormat("%Y-%m")(d.일자)
            );

            filtered.forEach(d => {
                d.년월 = d3.timeFormat("%Y-%m")(d.일자);
                d.PM10_month = grouped.get(d.지역)?.get(d.년월) ?? null;
            });

            setData(filtered);
        });
    }, []);

    useEffect(() => {
        if (data.length === 0) return;

        const svg = d3.select(ref.current);
        svg.selectAll("*").remove();

        const numericKeys = ["PM10", "PM10_month"];
        const groupKey = "계절";
        const size = 200;
        const padding = 40;
        const variables = numericKeys;
        const n = variables.length;
        const width = size * n + padding;
        const height = size * n + padding;

        const color = d3.scaleOrdinal()
            .domain(["봄", "가을", "겨울"])
            .range(["#f28e2c", "#59a14f", "#edc949"]);

        const radiusScale = d3.scaleSqrt()
            .domain(d3.extent(data, d => d.PM10))
            .range([2, 7]);

        const x = {}, y = {};
        variables.forEach(key => {
            const values = data.map(d => d[key]).filter(v => !isNaN(v));
            const extent = d3.extent(values);
            x[key] = d3.scaleLinear().domain(extent).nice().range([padding / 2, size - padding / 2]);
            y[key] = d3.scaleLinear().domain(extent).nice().range([size - padding / 2, padding / 2]);
        });

        const chart = svg
            .attr("viewBox", [0, 0, width + padding, height + 140])
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
            .attr("fill", "#fefefe")
            .attr("stroke", "#ddd")
            .attr("x", padding / 2)
            .attr("y", padding / 2)
            .attr("width", size - padding)
            .attr("height", size - padding)
            .attr("rx", 10);

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
                .attr("r", d => radiusScale(d.PM10))
                .attr("fill", d => color(d[groupKey]))
                .attr("fill-opacity", 0.75)
                .style("transition", "all 0.3s ease");
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
            .attr("transform", `translate(20, ${height + 20})`);

        ["봄", "가을", "겨울"].forEach((label, i) => {
            legend.append("circle")
                .attr("cx", 0)
                .attr("cy", i * 22)
                .attr("r", 6)
                .attr("fill", color(label));

            legend.append("text")
                .attr("x", 12)
                .attr("y", i * 22 + 4)
                .text(label)
                .style("font-size", "13px")
                .attr("fill", "#333");
        });

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 85)
            .attr("text-anchor", "middle")
            .style("font-size", "13px")
            .style("fill", "#555")
            .style("font-weight", "500")
            .text("p-value (봄 vs 가을 vs 겨울) = 0.00023 → 유의미한 차이 있음");
    }, [data]);

    return (
        <div style={{
            maxWidth: "1000px",
            margin: "0 auto",
            background: "#ffffff",
            padding: "30px",
            borderRadius: "12px",
            boxShadow: "0 6px 16px rgba(0, 0, 0, 0.08)"
        }}>
            <h2 style={{
                textAlign: "center",
                marginBottom: "24px",
                fontWeight: 600,
                fontSize: "22px",
                color: "#222"
            }}>
                PM10 PairPlot <span style={{ fontSize: "0.8em", color: "#888" }}>(봄 vs 가을 vs 겨울)</span>
            </h2>
            <svg ref={ref} width="100%" height={400}></svg>
        </div>
    );
};

export default NonSummerScatterPlot;