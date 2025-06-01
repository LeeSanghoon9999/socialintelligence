import React, { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import { saveSvgAsPng } from "save-svg-as-png";

export default function GradientEncoding({ data }) {
    const svgRef = useRef();

    // robust parsing
    const avgByDate = useMemo(() => {
        if (!data || !data.length) return [];
        // lowercase field map
        const norm = obj => Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])
        );
        const parsed = data
            .map(d => {
                const row = norm(d);
                const dateVal = row.date || row["일시"];
                let dateObj = null;
                if (dateVal instanceof Date) dateObj = dateVal;
                else if (typeof dateVal === "string") dateObj = d3.timeParse("%Y-%m-%d")(dateVal.slice(0, 10));
                const pm10 = +row.pm10 || +row["pm10"] || +row["PM10"];
                return { date: dateObj, pm10 };
            })
            .filter(d => d.date && !isNaN(d.pm10));
        const grouped = d3.rollup(
            parsed,
            v => d3.mean(v, d => d.pm10),
            d => d.date.getTime()
        );
        return Array.from(grouped, ([ts, pm10]) => ({
            date: new Date(ts),
            pm10
        })).sort((a, b) => a.date - b.date);
    }, [data]);

    function handleDownload() {
        const svgElement = svgRef.current;
        if (!svgElement) return;
        saveSvgAsPng(svgElement, `pm10-line.png`, {
            backgroundColor: "#ffffff",
            scale: 2,
        });
    }

    useEffect(() => {
        if (!avgByDate || avgByDate.length === 0) return;

        const width = 928, height = 300;
        const marginTop = 20, marginRight = 30, marginBottom = 30, marginLeft = 50;

        const x = d3.scaleUtc()
            .domain(d3.extent(avgByDate, d => d.date))
            .range([marginLeft, width - marginRight]);

        const yMax = Math.min(300, d3.max(avgByDate, d => d.pm10));
        const y = d3.scaleLinear()
            .domain([0, yMax]).nice()
            .range([height - marginBottom, marginTop]);

        const color = d3.scaleSequential(y.domain(), d3.interpolateTurbo);

        const line = d3.line()
            .curve(d3.curveMonotoneX)
            .defined(d => !isNaN(d.pm10) && d.pm10 <= yMax)
            .x(d => x(d.date))
            .y(d => y(d.pm10));

        d3.select(svgRef.current).selectAll("*").remove();
        const svg = d3.select(svgRef.current)
            .attr("viewBox", [0, 0, width, height])
            .attr("width", width)     // ← 추가!
            .attr("height", height)   // ← 추가!
            .style("background-color", "#ffffff")
            .style("max-width", "100%")
            .style("height", "auto");

        svg.insert("rect", ":first-child")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "#ffffff");

        // X축
        svg.append("g")
            .attr("transform", `translate(0,${height - marginBottom})`)
            .call(d3.axisBottom(x).ticks(width / 100).tickSizeOuter(0))
            .selectAll("text").style("font-size", "10px");

        // Y축
        svg.append("g")
            .attr("transform", `translate(${marginLeft},0)`)
            .call(d3.axisLeft(y).ticks(7))
            .call(g => g.select(".domain").remove())
            .selectAll("text").style("font-size", "10px");

        // Y축 그리드
        svg.append("g")
            .attr("class", "y-grid")
            .attr("transform", `translate(${marginLeft},0)`)
            .call(d3.axisLeft(y)
                .ticks(7)
                .tickSize(-(width - marginLeft - marginRight))
                .tickFormat(''))
            .selectAll("line").attr("stroke", "#eee");

        // Gradient 정의
        const gradId = `gradient-${Math.random().toString(36).substr(2, 9)}`;
        const linearGradient = svg.append("defs")
            .append("linearGradient")
            .attr("id", gradId)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", 0)
            .attr("y1", y.range()[0])
            .attr("x2", 0)
            .attr("y2", y.range()[1]);

        const N = 10;
        const stops = d3.ticks(0, 1, N).map(t => ({
            offset: t,
            color: color(y.domain()[0] + t * (y.domain()[1] - y.domain()[0]))
        }));
        linearGradient.selectAll("stop")
            .data(stops)
            .enter().append("stop")
            .attr("offset", d => d.offset)
            .attr("stop-color", d => d.color);

        // PM10 선
        svg.append("path")
            .datum(avgByDate.filter(d => !isNaN(d.pm10) && d.pm10 <= yMax))
            .attr("fill", "none")
            .attr("stroke", `url(#${gradId})`)
            .attr("stroke-width", 1.5)
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("d", line);
    }, [avgByDate]);

    return (
        <div>
            <svg ref={svgRef} width={928} height={300}></svg>
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
                    PM10 시계열 다운로드
                </button>
            </div>
        </div>
    );
}