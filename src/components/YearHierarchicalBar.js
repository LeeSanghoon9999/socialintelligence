import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// 계절 변환 맵
const seasonMap = {
    3:"봄",4:"봄",5:"봄", 6:"여름",7:"여름",8:"여름",
    9:"가을",10:"가을",11:"가을", 12:"겨울",1:"겨울",2:"겨울"
};

function buildHierarchy(rows){
    const root = { name:"미세먼지 합계", children:[] };
    const byYear = d3.group(rows, d=>d.연도);
    for (const [year, yearRows] of byYear){
        const yearNode = { name:`${year}년`, children:[] };
        const bySeason = d3.group(yearRows, d=>seasonMap[d.월]);
        for (const [season, seasonRows] of bySeason){
            const seasonNode = { name:season, children:[] };
            const byMonth = d3.group(seasonRows, d=>d.월);
            for (const [m, mRows] of byMonth){
                seasonNode.children.push({ name:`${m}월`, value:d3.sum(mRows, d=>d.PM10) });
            }
            seasonNode.value = d3.sum(seasonNode.children, d=>d.value);
            yearNode.children.push(seasonNode);
        }
        yearNode.value = d3.sum(yearNode.children, d=>d.value);
        root.children.push(yearNode);
    }
    root.value = d3.sum(root.children, d=>d.value);
    return root;
}

const W = 928, barStep = 27, barPad = 3/barStep,
    dur = 750, mTop = 30, mRight = 30, mBottom = 0, mLeft = 100;
const color = d3.scaleOrdinal([true,false],["steelblue","#aaa"]);

/**
 * @param {Object[]} props.data - [{연도, 월, PM10}] 형식의 배열 (외부 전달)
 */
export default function YearHierarchicalBarChart({ data }) {
    const svgRef = useRef();
    const [tree, setTree] = useState(null);

    // props.data가 없을 경우 fallback으로 직접 로딩 (option)
    useEffect(()=>{
        if(data && Array.isArray(data)) {
            setTree(buildHierarchy(
                data
                    .map(d=>({
                        연도: +d.연도 || +d["연도"] || +d["일시"]?.slice(0,4),
                        월: +d.월 || +d["월"] || +d["일시"]?.slice(5,7),
                        PM10: +d.PM10 || +d["PM10"] || +d.pm10
                    }))
                    .filter(r=>r.연도 && r.월 && !isNaN(r.PM10))
            ));
        } else {
            // fallback: 자체 로드
            d3.csv("/data/preprocessed_data.csv", d=>({
                연도:+d["일시"].slice(0,4),
                월 :+d["일시"].slice(5,7),
                PM10:+d["PM10"]
            })).then(rows=>{
                setTree(buildHierarchy(rows.filter(r=>r.연도 && r.월 && !isNaN(r.PM10))));
            });
        }
    },[data]);

    useEffect(()=>{
        if(!tree) return;
        const root = d3.hierarchy(tree).sum(d=>d.value).sort((a,b)=>b.value-a.value);
        let maxRows = 1;
        root.each(d=>d.children && (maxRows=Math.max(maxRows, d.children.length)));
        const H = maxRows*barStep + mTop + mBottom;
        const x = d3.scaleLinear().range([mLeft, W-mRight]);
        const xAxis = g=>g
            .attr("class","x-axis")
            .attr("transform",`translate(0,${mTop})`)
            .call(d3.axisTop(x).ticks(W/80,"s"))
            .call(g=>g.select(".domain").remove());
        const yAxis = g=>g
            .attr("class","y-axis")
            .attr("transform",`translate(${mLeft},0)`)
            .call(g=>g.append("line")
                .attr("stroke","currentColor")
                .attr("y1",mTop)
                .attr("y2",H-mBottom));
        function stack(i){
            let v=0;
            return d=>{
                const t=`translate(${x(v)-x(0)},${barStep*i})`;
                v+=d.value;
                return t;
            };
        }
        function stagger(){
            let v=0;
            return (_,i)=>{
                const t=`translate(${x(v)-x(0)},${barStep*i})`;
                v+=_.value;
                return t;
            };
        }
        function drawBars(svg, down, node, selector){
            const g = svg.insert("g",selector)
                .attr("class","enter")
                .attr("transform",`translate(${x(0)},${mTop+barStep*barPad})`)
                .attr("text-anchor","end")
                .style("font","10px 'Inter','Noto Sans KR',sans-serif");
            const bar = g.selectAll("g")
                .data(node.children)
                .join("g")
                .attr("cursor",d=>d.children?"pointer":null)
                .attr("transform",(d,i)=>`translate(0,${barStep*i})`)
                .on("click",(e,child)=>{ e.stopPropagation(); down(svg,child); });
            bar.append("text")
                .attr("x",-6)
                .attr("y",barStep*(1-barPad)/2)
                .attr("dy",".35em")
                .text(d=>d.data.name);
            bar.append("rect")
                .attr("x",x(0)-100)
                .attr("width",d=>x(d.value)-x(0))
                .attr("height",barStep*(1-barPad))
                .attr("fill",d=>color(!!d.children));
            return g;
        }
        function down(svg,node){
            if(!node.children||d3.active(svg.node())) return;
            svg.select(".background").datum(node);
            const split = d3.scaleLinear()
                .domain([0,node.value])
                .range([x(0), x(node.value)]);
            const t1 = svg.transition().duration(dur);
            const t2 = t1.transition();
            const t3 = t2.transition();
            svg.selectAll(".enter").attr("class","exit")
                .transition(t1).attr("fill-opacity",0).remove();
            const enter = drawBars(svg,down,node,".y-axis").attr("fill-opacity",0);
            enter.selectAll("g")
                .attr("transform",(child,i)=>{
                    const offset = d3.sum(node.children.slice(0,i), c=>c.value);
                    return `translate(${split(offset)-x(0)},0)`;
                });
            enter.selectAll("rect")
                .attr("width",c=>split(c.value)-split(0))
                .attr("fill",color(true));
            enter.transition(t1).attr("fill-opacity",1);
            enter.selectAll("g").transition(t1)
                .attr("transform",(child,i)=>{
                    const offset = d3.sum(node.children.slice(0,i), c=>c.value);
                    return `translate(${split(offset)-x(0)},${barStep*i})`;
                });
            enter.selectAll("g").transition(t2)
                .attr("transform",(child,i)=>`translate(0,${barStep*i})`);
            x.domain([0,d3.max(node.children,c=>c.value)]);
            svg.selectAll(".x-axis").transition(t3).call(xAxis);
            enter.selectAll("rect").transition(t3)
                .attr("x",x(0)-100)
                .attr("width",c=>x(c.value)-x(0))
                .attr("fill",c=>color(!!c.children));
        }
        function up(svg,node){
            if(!node.parent || !svg.selectAll(".exit").empty()) return;
            svg.select(".background").datum(node.parent);
            const t1=svg.transition().duration(dur);
            const t2=t1.transition();
            const exit = svg.selectAll(".enter").attr("class","exit");
            x.domain([0,d3.max(node.parent.children,c=>c.value)]);
            svg.selectAll(".x-axis").transition(t1).call(xAxis);
            exit.selectAll("g").transition(t1).attr("transform",stagger());
            exit.selectAll("g").transition(t2).attr("transform",stack(node.index));
            exit.selectAll("rect").transition(t1)
                .attr("width",d=>x(d.value)-x(0))
                .attr("fill",color(true));
            exit.transition(t2).attr("fill-opacity",0).remove();
            const enter = drawBars(svg,down,node.parent,".exit").attr("fill-opacity",0);
            enter.selectAll("g")
                .attr("transform",(d,i)=>`translate(${x(0)-100},${barStep*i})`);
            enter.transition(t2).attr("fill-opacity",1);
            enter.selectAll("rect")
                .attr("fill",d=>color(!!d.children))
                .attr("fill-opacity",p=>p===node?0:null)
                .transition(t2)
                .attr("width",d=>x(d.value)-x(0))
                .on("end",function(){ d3.select(this).attr("fill-opacity",1); });
        }
        d3.select(svgRef.current).selectAll("*").remove();
        const svg = d3.select(svgRef.current)
            .attr("width", W)
            .attr("height", H)
            .attr("style", "max-width:100%; height:auto; font:10px 'Inter','Noto Sans KR',sans-serif;");
        x.domain([0,d3.max(root.children,c=>c.value)]);
        svg.append("rect")
            .attr("class","background")
            .attr("fill","none")
            .attr("pointer-events","all")
            .attr("width",W)
            .attr("height",H)
            .attr("cursor","pointer")
            .datum(root)
            .on("click", function(event, n){
                up(svg, d3.select(this).datum());
            });
        svg.append("g").call(xAxis);
        svg.append("g").call(yAxis);
        drawBars(svg,down,root,".y-axis");
    },[tree]);

    return <svg ref={svgRef}/>;
}