import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

const RegionMonthMap = ({ data: rawData }) => {
    const ref = useRef();
    const [monthIndex, setMonthIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const drawnSet = useRef(new Set());
    const lastIndex = useRef(0);

    // 1. 데이터 전처리: props로 들어온 rawData로 그룹핑
    const data = React.useMemo(() => {
        if (!rawData || !rawData.length) return [];
        // 일자, PM10, 발전소(1/0) 구분
        const processed = rawData.map(d => {
            const yyyymm = d["일시"]?.slice(0, 7) ?? d["date"]?.slice(0, 7) ?? "";
            const pm10 = +d["PM10"] ?? +d["pm10"];
            const key = (+d["발전소"] === 1 || d["plant"] === "1") ? "plant" : "nplant";
            return { yyyymm, pm10, key };
        }).filter(d => d.yyyymm && !isNaN(d.pm10));
        // 월/plant별 평균
        const grouped = d3.rollup(
            processed,
            v => d3.mean(v, d => d.pm10),
            d => d.yyyymm,
            d => d.key
        );
        const arr = [];
        grouped.forEach((inner, ym) => {
            arr.push({
                date: ym,
                plant: inner.get("plant") ?? 0,
                nplant: inner.get("nplant") ?? 0
            });
        });
        arr.sort((a, b) => d3.ascending(a.date, b.date));
        return arr;
    }, [rawData]);

    useEffect(() => {
        if (!data.length) return;
        drawnSet.current = new Set(); // 그래프 새로 그릴 때 클리어
        lastIndex.current = 0;

        const svg = d3.select(ref.current);
        const width = 800;
        const height = 500;
        const margin = { top: 40, right: 20, bottom: 80, left: 60 };

        svg.selectAll("*").remove();

        const x = d3
            .scaleBand()
            .domain(data.map(d => d.date))
            .range([margin.left, width - margin.right])
            .padding(0);

        const y = d3
            .scaleLinear()
            .domain([0, d3.max(data, d => Math.max(d.plant, d.nplant)) * 1.5])
            .range([height - margin.bottom, margin.top]);

        svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 2 === 0)))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        svg.append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));
    }, [data]);

    useEffect(() => {
        if (!data.length) return;

        const svg = d3.select(ref.current);
        const width = 800;
        const height = 500;
        const margin = { top: 40, right: 20, bottom: 80, left: 60 };

        const x = d3
            .scaleBand()
            .domain(data.map(d => d.date))
            .range([margin.left, width - margin.right])
            .padding(0);

        const y = d3
            .scaleLinear()
            .domain([0, d3.max(data, d => Math.max(d.plant, d.nplant)) * 1.5])
            .range([height - margin.bottom, margin.top]);

        const drawBar = (i) => {
            const entry = data[i];
            const date = entry.date;
            if (drawnSet.current.has(date)) return;
            drawnSet.current.add(date);

            const base = Math.min(entry.plant, entry.nplant);
            const top = Math.max(entry.plant, entry.nplant);
            const winner = entry.plant > entry.nplant ? "발전소" : "비발전소";

            svg.append("rect")
                .attr("x", x(date))
                .attr("data-date", date)
                .attr("y", y(0))
                .attr("width", x.bandwidth())
                .attr("height", 0)
                .attr("fill", "#444")
                .transition()
                .duration(150)
                .attr("y", y(base))
                .attr("height", y(0) - y(base));

            svg.append("rect")
                .attr("x", x(date))
                .attr("data-date", date)
                .attr("y", y(0))
                .attr("width", x.bandwidth())
                .attr("height", 0)
                .attr("fill", winner === "비발전소" ? "#4e79a7" : "#e15759")
                .transition()
                .duration(150)
                .attr("y", y(top))
                .attr("height", y(base) - y(top));
        };

        const removeBar = (i) => {
            const entry = data[i];
            const date = entry.date;
            drawnSet.current.delete(date);

            svg.selectAll(`rect[data-date='${date}']`)
                .transition()
                .duration(150)
                .attr("y", y(0))
                .attr("height", 0)
                .remove();
        };

        if (monthIndex > lastIndex.current) {
            for (let i = lastIndex.current + 1; i <= monthIndex; i++) drawBar(i);
        } else if (monthIndex < lastIndex.current) {
            for (let i = lastIndex.current; i > monthIndex; i--) removeBar(i);
        }
        lastIndex.current = monthIndex;
    }, [data, monthIndex]);

    useEffect(() => {
        if (playing) {
            const delay = 5000 / (data.length || 1);
            const interval = setInterval(() => {
                setMonthIndex(prev => {
                    if (prev >= data.length - 1) {
                        clearInterval(interval);
                        return data.length - 1;
                    }
                    return prev + 1;
                });
            }, delay);
            return () => clearInterval(interval);
        }
    }, [playing, data.length]);

    const handleSliderChange = (value) => setMonthIndex(value);

    return (
        <div>
            <svg ref={ref} width={800} height={500}></svg>
            <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "20px", height: "20px", backgroundColor: "#4e79a7" }}></div>
                    <span>발전소 지역 평균</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "20px", height: "20px", backgroundColor: "#e15759" }}></div>
                    <span>비발전소 지역 평균</span>
                </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "10px" }}>
                <button onClick={() => setPlaying(true)}>▶ Play</button>
                <input
                    type="range"
                    min="0"
                    max={Math.max(data.length - 1, 0)}
                    value={monthIndex}
                    onChange={e => handleSliderChange(+e.target.value)}
                    style={{ width: "300px" }}
                />
                <button onClick={() => setPlaying(false)}>⏸ Pause</button>
            </div>
        </div>
    );
};

export default RegionMonthMap;