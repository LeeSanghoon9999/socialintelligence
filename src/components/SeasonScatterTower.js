import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

// 계절 구분
const getSeason = (date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if ((month === 3 && day >= 1) || (month > 3 && month < 5) || (month === 5 && day <= 30)) return "봄";
    if ((month === 5 && day >= 31) || (month > 5 && month < 9) || (month === 8 && day <= 25)) return "여름";
    if ((month === 9 && day >= 26) || (month > 8 && month < 11) || (month === 11 && day <= 29)) return "가을";
    return "겨울";
};

const getSpringIndex = (month, day) => {
    const monthDays = [31,28,31,30,31,30,31,31,30,31,30,31];
    let idx = 0;
    if (month >= 3) {
        for(let m = 3; m < month; ++m) idx += monthDays[m-1];
        idx += day - 1;
    } else {
        for(let m = 3; m <= 12; ++m) idx += monthDays[m-1];
        for(let m = 1; m < month; ++m) idx += monthDays[m-1];
        idx += day - 1;
    }
    return idx;
};

const monthsOrder = [3,4,5,6,7,8,9,10,11,12,1,2];
const monthDays = [31,28,31,30,31,30,31,31,30,31,30,31];

const SeasonScatterTower = () => {
    const svgRef = useRef();
    const [cluster, setCluster] = useState("overview");
    const [allData, setAllData] = useState([]);
    const width = 900, height = 500;
    const margin = { top: 30, right: 30, bottom: 30, left: 60 };

    // 데이터 로드
    useEffect(() => {
        d3.csv("/data/preprocessed_data.csv", d => ({
            일자: new Date(d["일시"]),
            PM10: +d["PM10"]
        })).then(raw => {
            const filtered = raw
                .map(d => {
                    const month = d.일자.getMonth() + 1;
                    const day = d.일자.getDate();
                    return {
                        계절: getSeason(d.일자),
                        PM10: d.PM10,
                        month,
                        day,
                        idx: getSpringIndex(month, day),
                        md: `${month}-${day}`
                    };
                });
            setAllData(filtered);
        });
    }, []);

    // --- 그래프와 축을 통째로 관리 ---
    useEffect(() => {
        if (!allData.length) return;

        // 전체 범위용 스케일 (raw)
        const x = d3.scaleLinear()
            .domain([-30, getSpringIndex(3, 1) + 364])
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, 1000])
            .range([height - margin.bottom, margin.top]);

        const color = d3.scaleOrdinal()
            .domain(["봄", "여름", "가을", "겨울"])
            .range(["#1f77b4", "#e377c2", "#ff7f0e", "#2ca02c"]);

        // SVG
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // 점 그룹
        const g = svg.append("g").attr("class", "dots");
        g.selectAll("circle")
            .data(allData)
            .join("circle")
            .attr("cx", d => x(d.idx))
            .attr("cy", d => y(d.PM10))
            .attr("r", 4)
            .attr("fill", d => color(d.계절))
            .attr("opacity", 0.85);

        // X축: 3월~2월 라벨
        const monthTicks = [];
        let acc = 0;
        monthsOrder.forEach(m => {
            monthTicks.push(acc + 1);
            acc += monthDays[m - 1];
        });

        // x축, y축 append
        const gx = svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height - margin.bottom})`);
        const gy = svg.append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${margin.left},0)`);

        gx.call(
            d3.axisBottom(x)
                .tickValues(monthTicks)
                .tickFormat((d, i) => {
                    const m = monthsOrder[i] || 3;
                    return `${m}월`;
                })
        );
        gy.call(d3.axisLeft(y));

        // 줌 객체(zoomRef에 저장)
        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", (event) => {
                // 점들 이동
                g.attr("transform", event.transform);
                // 축 업데이트
                gx.call(
                    d3.axisBottom(event.transform.rescaleX(x))
                        .tickValues(monthTicks)
                        .tickFormat((d, i) => {
                            const m = monthsOrder[i] || 3;
                            return `${m}월`;
                        })
                );
                gy.call(
                    d3.axisLeft(event.transform.rescaleY(y))
                );
            });
        svg.call(zoom);
        svg.property("__zoom", d3.zoomIdentity); // 초기화

        // Overview로 초기화
        svg.transition().duration(800).call(zoom.transform, d3.zoomIdentity);

        // zoom 객체를 useRef에 저장 (클러스터별 뷰 이동에 활용)
        svgRef.current.__zoomObj = zoom;
        svgRef.current.__x = x;
        svgRef.current.__y = y;
        svgRef.current.__gx = gx;
        svgRef.current.__gy = gy;
    }, [allData]);

    // --- 클러스터(계절) 확대 ---
    useEffect(() => {
        if (!allData.length) return;
        const svg = d3.select(svgRef.current);
        const x = svgRef.current.__x;
        const y = svgRef.current.__y;
        const zoom = svgRef.current.__zoomObj;
        const gx = svgRef.current.__gx;
        const gy = svgRef.current.__gy;

        if (cluster === "overview") {
            svg.transition().duration(800)
                .call(zoom.transform, d3.zoomIdentity);
        } else {
            const data = allData.filter(d => d.계절 === cluster);
            const [x0, x1] = d3.extent(data, d => d.idx);
            const [y0, y1] = d3.extent(data, d => d.PM10);

            // 확대 비율 계산
            const k = 0.9 * Math.min(
                (svg.attr("width")-margin.left-margin.right) / (x(x1)-x(x0)),
                (svg.attr("height")-margin.top-margin.bottom) / (y(y0)-y(y1))
            );
            const tx = (svg.attr("width")-k*(x(x0)+x(x1)))/2;
            const ty = (svg.attr("height")-k*(y(y0)+y(y1)))/2;
            const transform = d3.zoomIdentity.translate(tx, ty).scale(k);

            svg.transition().duration(1000)
                .call(zoom.transform, transform);
        }
    }, [cluster, allData]);

    return (
        <div>
            <h3>PM10 - 월일별 계절 클러스터 산점도</h3>
            <div style={{marginBottom: 12}}>
                <button onClick={() => setCluster("overview")} style={{marginRight: 8, fontWeight: cluster==="overview"?"bold":"normal"}}>Overview</button>
                <button onClick={() => setCluster("봄")} style={{marginRight: 8, fontWeight: cluster==="봄"?"bold":"normal"}}>봄</button>
                <button onClick={() => setCluster("여름")} style={{marginRight: 8, fontWeight: cluster==="여름"?"bold":"normal"}}>여름</button>
                <button onClick={() => setCluster("가을")} style={{marginRight: 8, fontWeight: cluster==="가을"?"bold":"normal"}}>가을</button>
                <button onClick={() => setCluster("겨울")} style={{fontWeight: cluster==="겨울"?"bold":"normal"}}>겨울</button>
            </div>
            <svg ref={svgRef} width={900} height={500} style={{background: "#fafafa", borderRadius: 10}}></svg>
        </div>
    );
};

export default SeasonScatterTower;