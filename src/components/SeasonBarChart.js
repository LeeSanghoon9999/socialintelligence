import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

// 4계절 색상 매핑
const seasonColors = {
    "Spring": "#FFB347",
    "Summer": "#77DD77",
    "Autumn": "#FF6961",
    "Winter": "#AEC6CF"
};

const SeasonBarChart = () => {
    const chartRef = useRef();
    const [seasonData, setSeasonData] = useState([]);

    useEffect(() => {
        d3.json('/df_month.json').then(data => {
            // 1) 계절별 카운트
            const grouped = d3.rollups(
                data,
                v => v.length,
                d => d['계절']
            );
            // 예: [ ["Spring", 10], ["Summer", 20], ... ]

            // 2) null 제거 + 정렬(선택사항)
            const finalData = grouped
                .filter(([season]) => season !== null)
                // .sort(...) 필요한 경우 정렬
                .map(([season, count]) => ({ season, count }));

            setSeasonData(finalData);
        });
    }, []);

    useEffect(() => {
        if (seasonData.length === 0) return;

        const svgWidth = 600;
        const svgHeight = 400;
        const margin = { top: 50, right: 50, bottom: 50, left: 60 };

        d3.select(chartRef.current).selectAll('*').remove(); // 기존 내용 제거

        const svg = d3.select(chartRef.current)
            .attr('width', svgWidth)
            .attr('height', svgHeight);

        // X축: 계절
        const xScale = d3.scaleBand()
            .domain(seasonData.map(d => d.season))
            .range([margin.left, svgWidth - margin.right])
            .padding(0.2);

        // Y축: 방문객 수
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(seasonData, d => d.count)])
            .nice()
            .range([svgHeight - margin.bottom, margin.top]);

        // 막대
        svg.selectAll('.bar')
            .data(seasonData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.season))
            .attr('y', d => yScale(d.count))
            .attr('width', xScale.bandwidth())
            .attr('height', d => (svgHeight - margin.bottom) - yScale(d.count))
            // 계절별 지정 색상 사용
            .attr('fill', d => seasonColors[d.season] || 'gray');

        // X축
        svg.append('g')
            .attr('transform', `translate(0,${svgHeight - margin.bottom})`)
            .call(d3.axisBottom(xScale));

        // Y축
        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(yScale));

        // 텍스트 라벨
        svg.selectAll('.label')
            .data(seasonData)
            .enter()
            .append('text')
            .attr('class', 'label')
            .attr('x', d => xScale(d.season) + xScale.bandwidth() / 2)
            .attr('y', d => yScale(d.count) - 5)
            .attr('text-anchor', 'middle')
            .text(d => d.count);

        // 타이틀
        svg.append('text')
            .attr('x', svgWidth / 2)
            .attr('y', margin.top / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .text('계절별 방문투어객 수');
    }, [seasonData]);

    return (
        <div>
            <svg ref={chartRef}></svg>
        </div>
    );
};

export default SeasonBarChart;
