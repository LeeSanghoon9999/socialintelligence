/* src/components/RFFeatureBar.jsx */
import React,{useEffect,useState}   from "react";
import { Group }                    from "@visx/group";
import { scaleLinear,scaleBand }    from "@visx/scale";
import { Bar }                      from "@visx/shape";

export default function RFFeatureBar(){
    const [data,setData]=useState([]);
    useEffect(()=>{
        fetch("/data/rf_feature_importance.json")
            .then(r=>r.json()).then(setData);
    },[]);

    if(!data.length) return null;

    const width  = 500, height = 320, margin = {top:20,right:20,bottom:20,left:160};
    const yScale = scaleBand({
        domain: data.map(d=>d.feature),
        range : [margin.top,height-margin.bottom],
        padding: .2
    });
    const xScale = scaleLinear({
        domain:[0,Math.max(...data.map(d=>d.importance))*1.1],
        range:[margin.left,width-margin.right]
    });

    return (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
            <Group>
                {data.map(d=>(
                    <Bar key={d.feature}
                         x={margin.left}
                         y={yScale(d.feature)}
                         height={yScale.bandwidth()}
                         width={xScale(d.importance)-margin.left}
                         fill="#4e79a7" />
                ))}
                {data.map(d=>(
                    <text key={d.feature+"label"}
                          x={margin.left-6}
                          y={yScale(d.feature)+yScale.bandwidth()/2}
                          dy=".35em"
                          fontSize="12"
                          textAnchor="end">{d.feature}</text>
                ))}
            </Group>
        </svg>
    );
}