import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";

const codePrefixToProvince = {
    "11": "서울특별시", "21": "부산광역시", "22": "대구광역시", "23": "인천광역시",
    "24": "광주광역시", "25": "대전광역시", "26": "울산광역시", "29": "세종특별자치시",
    "31": "경기도", "32": "강원특별자치도", "33": "충청북도", "34": "충청남도",
    "35": "전라북도", "36": "전라남도", "37": "경상북도", "38": "경상남도", "39": "제주특별자치도"
};

const shortToLongProvince = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시", "인천": "인천광역시",
    "광주": "광주광역시", "대전": "대전광역시", "울산": "울산광역시", "세종": "세종특별자치시",
    "경기": "경기도", "강원": "강원특별자치도", "충북": "충청북도", "충남": "충청남도",
    "전북": "전라북도", "전남": "전라남도", "경북": "경상북도", "경남": "경상남도", "제주": "제주특별자치도"
};

const KoreaMapPower = ({ data, topo }) => {
    const svgRef = useRef(null);

    useEffect(() => {
        if (!data || !topo) return;

        const width = 1300;
        const height = 900;

        const svg = d3.select(svgRef.current)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("width", "100%")
            .style("height", "auto")
            .style("background", "#f9f9f9");

        svg.selectAll("*").remove();

        // 데이터 전처리
        const rows = data
            .filter(d => d["연"] === "2021")
            .map(d => {
                const [shortProvince, sigungu] = d["지역"].trim().split(" ");
                const province = shortToLongProvince[shortProvince];
                return {
                    province,
                    sigungu,
                    fullRegion: province && sigungu ? `${province} ${sigungu}` : null,
                    발전소: +d["발전소"]
                };
            })
            .filter(d => d?.fullRegion);

        // 발전소 유무 rollup
        const presence = d3.rollup(
            rows,
            v => d3.max(v, d => d.발전소 > 0 ? 1 : 0),
            d => d.fullRegion
        );

        // 지도 topojson
        const topoKey = Object.keys(topo.objects)[0];
        const geo = topojson.feature(topo, topo.objects[topoKey]);

        const projection = d3.geoMercator().fitSize([width, height], geo);
        const path = d3.geoPath().projection(projection);

        // Tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "korea-power-tooltip")
            .style("position", "absolute")
            .style("background", "#fff")
            .style("padding", "6px 10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
            .style("opacity", 0);

        const g = svg.append("g");

        // Draw boundaries
        g.selectAll("path")
            .data(geo.features)
            .join("path")
            .attr("d", path)
            .attr("fill", "#eee")
            .attr("stroke", "#aaa")
            .attr("stroke-width", 0.5);

        // Draw bubbles
        g.selectAll("circle")
            .data(geo.features.filter(d => {
                const codePrefix = d.properties.code.slice(0, 2);
                const province = codePrefixToProvince[codePrefix];
                const full = `${province} ${d.properties.name}`;
                return presence.get(full) === 1;
            }))
            .join("circle")
            .attr("cx", d => path.centroid(d)[0])
            .attr("cy", d => path.centroid(d)[1])
            .attr("r", 15)
            .attr("fill", "rgba(255, 100, 100, 0.7)")
            .attr("stroke", "#900")
            .attr("stroke-width", 1)
            .on("mouseover", function (event, d) {
                const province = codePrefixToProvince[d.properties.code.slice(0, 2)];
                const full = `${province} ${d.properties.name}`;
                d3.select(this).attr("stroke", "#000").attr("stroke-width", 1.5);
                tooltip.html(`<strong>${full}</strong><br/>발전소 존재: ✅`)
                    .style("opacity", 1);
            })
            .on("mousemove", event => {
                tooltip
                    .style("left", event.pageX + 10 + "px")
                    .style("top", event.pageY - 28 + "px");
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke", "#900").attr("stroke-width", 1);
                tooltip.style("opacity", 0);
            });

        // cleanup (tooltip 중복 방지)
        return () => d3.selectAll(".korea-power-tooltip").remove();

    }, [data, topo]);

    return <svg ref={svgRef} />;
};

export default KoreaMapPower;