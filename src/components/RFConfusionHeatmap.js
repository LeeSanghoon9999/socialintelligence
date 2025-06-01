/* src/components/RFConfusionHeatmap.jsx */
import React,{useEffect,useState} from "react";
import Plot                       from "react-plotly.js";

export default function RFConfusionHeatmap(){
    const [cm,setCm]     = useState([]);
    const [labels,setLab]= useState([]);
    useEffect(()=>{
        fetch("/data/confusion_matrix.json")
            .then(r=>r.json())
            .then(({matrix,class_labels})=>{
                setCm(matrix); setLab(class_labels);
            });
    },[]);
    if(!cm.length) return null;

    return(
        <Plot
            data={[{
                z:cm, x:labels, y:labels,
                type:"heatmap", colorscale:"Blues",
                text:cm.map(row=>row.map(String)),
                hovertemplate:"실제 %{y}<br>예측 %{x}<br>%{text} 건<extra></extra>"
            }]}
            layout={{
                height:430, margin:{t:40,l:100,r:60,b:100},
                xaxis:{title:"Predicted"}, yaxis:{title:"Actual"},
                paper_bgcolor:"rgba(0,0,0,0)", plot_bgcolor:"rgba(0,0,0,0)"
            }}
            config={{displayModeBar:false, responsive:true}}
            style={{width:"100%", height:"100%"}}
        />
    );
}