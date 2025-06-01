import React, { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";

const SEASONS = ["봄", "여름", "가을", "겨울"];
const PM10_BINS = [10, 20, 30, 40, 50, 60, 70, 80]; // 8구간
const COLORS = d3.schemeSpectral[9].reverse();      // 9색

export default function GroupedBarChart({ data: rawData }) {
    const svgRef = useRef();

    // 데이터 가공 (계절별 연도별 PM10)
    const data = useMemo(() => {
        if (!rawData || !rawData.length) return [];
        const seasonMap = {
            3: "봄", 4: "봄", 5: "봄",
            6: "여름", 7: "여름", 8: "여름",
            9: "가을", 10: "가을", 11: "가을",
            12: "겨울", 1: "겨울", 2: "겨울"
        };
        // 일시, PM10 컬럼명 강건하게 변환
        const rows = rawData.map(d => ({
            year: +d["일시"]?.slice(0, 4) || +d["year"],
            month: +d["일시"]?.slice(5, 7) || +d["month"],
            pm10: +d.PM10 || +d.pm10,
        })).filter(d => !isNaN(d.year) && !isNaN(d.month) && !isNaN(d.pm10));
        const group = d3.rollup(
            rows,
            v => d3.mean(v, d => d.pm10),
            d => d.year,
            d => seasonMap[d.month]
        );
        let out = [];
        for (const [year, seasons] of group.entries()) {
            for (const season of SEASONS) {
                out.push({
                    year,
                    season,
                    value: (seasons.get(season) || 0)
                });
            }
        }
        return out;
    }, [rawData]);

    useEffect(() => {
        if (!data || !data.length) return;

        const years = Array.from(new Set(data.map(d => d.year))).sort();
        const width = 1100, height = 440;
        const margin = { top: 80, right: 30, bottom: 70, left: 220 };
        const barWidth = 10;
        const seasonGap = 2;
        const groupGap = 64;

        const groupOffset = 100;
        const getBarX = (yearIdx, seasonIdx) =>
            margin.left + groupOffset+ yearIdx * (SEASONS.length * (barWidth + seasonGap) + groupGap - seasonGap)
            + seasonIdx * (barWidth + seasonGap);

        const y = d3.scaleLinear()
            .domain([0, 70])
            .range([height - margin.bottom, margin.top]);

        const color = d3.scaleThreshold()
            .domain(PM10_BINS)
            .range(COLORS);

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        svg.append("g")
            .selectAll("rect")
            .data(data)
            .join("rect")
            .attr("x", d => {
                const yearIdx = years.indexOf(d.year);
                const seasonIdx = SEASONS.indexOf(d.season);
                return getBarX(yearIdx, seasonIdx);
            })
            .attr("y", d => y(d.value))
            .attr("width", barWidth)
            .attr("height", d => y(0) - y(d.value))
            .attr("fill", d => color(d.value));

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(7, "s"))
            .call(g => g.select(".domain").remove())
            .selectAll("text")
            .style("font-size", "13px")
            .style("fill", "#222")
            .style("font-family", "Inter, sans-serif");

        svg.append("g")
            .selectAll("text.seasons")
            .data(years)
            .join("text")
            .attr("class", "seasons")
            .attr("x", (d, i) =>
                getBarX(i, 0) + ((SEASONS.length * (barWidth + seasonGap) - seasonGap) / 2)
            )
            .attr("y", height - margin.bottom + 15)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("fill", "#555")
            .style("font-family", "Inter, sans-serif")
            .style("font-weight", 500)
            .text("봄  여름  가을  겨울");

        svg.append("g")
            .selectAll("text.year")
            .data(years)
            .join("text")
            .attr("class", "year")
            .attr("x", (d, i) =>
                getBarX(i, 0) + (SEASONS.length * (barWidth + seasonGap) - seasonGap) / 2
            )
            .attr("y", height - margin.bottom + 38)
            .attr("text-anchor", "middle")
            .style("font-size", "19px")
            .style("font-weight", 600)
            .style("fill", "#222")
            .style("font-family", "Inter, sans-serif")
            .text(d => d);

        // 범례
        const legendW = 40;
        const legend = svg.append("g")
            .attr("transform", `translate(${margin.left + 70},${margin.top - 55})`);
        COLORS.forEach((c, i) => {
            legend.append("rect")
                .attr("x", i * legendW)
                .attr("y", 0)
                .attr("width", legendW)
                .attr("height", 16)
                .attr("fill", c);
            legend.append("text")
                .attr("x", i * legendW + legendW / 2)
                .attr("y", 28)
                .attr("text-anchor", "middle")
                .style("font-size", "13px")
                .style("fill", "#222")
                .text(i === 0 ? `<${PM10_BINS[0]}` :
                    i === COLORS.length - 1 ? `≥${PM10_BINS[PM10_BINS.length - 1]}` :
                        `${PM10_BINS[i - 1]}-${PM10_BINS[i] - 1}`);
        });
        legend.append("text")
            .attr("x", 0)
            .attr("y", -10)
            .style("font-size", "14px")
            .style("font-weight", 600)
            .style("fill", "#222")
            .text("PM10 농도 구간");
    }, [data]);

    return (
        <svg
            ref={svgRef}
            width={1100}
            height={440}
            style={{
                background: "#fff",
                display: "block",
                margin: "32px auto"
            }}
        />
    );
}