/* src/components/LogitDotPlot.jsx */
import React,{useEffect,useState} from "react";
import Plot                       from "react-plotly.js";

const pCut = 0.05;         // 유의수준 표시

export default function LogitDotPlot(){
    const [rows,setRows] = useState([]);
    useEffect(()=>{ fetch("/data/mnlogit_params.json").then(r=>r.json()).then(setRows); },[]);
    if(!rows.length) return null;

    const grades   = [...new Set(rows.map(d=>d.grade))];   // 등급 3개
    const features = [...new Set(rows.map(d=>d.feature))]; // 변수 순서 고정

    const traces = grades.map(g=>{
        const sub = rows.filter(r=>r.grade===g);
        return {
            x      : sub.map(r=>r.coef),
            y      : sub.map(r=>r.feature),
            mode   : "markers",
            name   : g,
            marker : {
                size : 10,
                color: g==="매우나쁨" ? "#e15759" :
                    g==="나쁨"   ? "#f28e2b" :
                        "#4e79a7"
            },
            text   : sub.map(r=>`p=${r.p.toExponential(1)}`),
            hovertemplate:
                "<b>%{y}</b><br>%{x:.3f}<br>%{text}<extra></extra>"
        };
    });

    return (
        <Plot
            data={traces}
            layout={{
                height:440, margin:{l:140,r:30,t:40,b:40},
                xaxis:{title:"Coefficient"},
                yaxis:{autorange:"reversed"},
                shapes: [{ // 0 선
                    type:"line", x0:0,x1:0, y0:-1, y1:features.length,
                    line:{width:1,color:"#333"}
                }],
                legend:{orientation:"h", y:-0.18},
                paper_bgcolor:"rgba(0,0,0,0)",
                plot_bgcolor:"rgba(0,0,0,0)"
            }}
            config={{displayModeBar:false,responsive:true}}
            style={{width:"100%",height:"100%"}}
        />
    );
}