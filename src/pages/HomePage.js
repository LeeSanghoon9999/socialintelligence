/* ---------- HomePage.jsx ---------- */
import React, { useEffect, useRef, useState, Suspense, lazy } from "react";
import styled, { keyframes } from "styled-components";
import * as d3 from "d3";

/* ---------- lazy-load viz (첫 화면 로딩 최적화) ---------- */
const WorldMap            = lazy(()=>import("../components/WorldMap"));
const TotalCarmap= lazy(()=>import("../components/TotalCarmap"));
const TotalPM10map= lazy(()=>import("../components/TotalPM10map"));
const TotalRainmap= lazy(()=>import("../components/TotalRainmap"));
const TotalTempmap= lazy(()=>import("../components/TotalTempmap"));
const KoreaMapPower= lazy(()=>import("../components/KoreaMapPower"));
const SeasonalWindmap= lazy(()=>import("../components/SeasonalWindmap"));
const SeasonalTempmap= lazy(()=>import("../components/SeasonalTempmap"));
const SeasonalPM10map= lazy(()=>import("../components/SeasonalPM10map"));
const SeasonalRainmap= lazy(()=>import("../components/SeasonalRainmap"))
const RegionMonthMap      = lazy(()=>import("../components/RegionMonthMap"));
const RegionScatterPlot   = lazy(()=>import("../components/RegionScatterPlot"));
const SeasonScatterPlot   = lazy(()=>import("../components/SeasonScatterPlot"));
const NonSummerScatterPlot= lazy(()=>import("../components/NonSummerScatterPlot"));
const SeoulSeasonHeatmap  = lazy(()=>import("../components/SeoulSeasonHeatmap"));
const SeasonScatterTower  = lazy(()=>import("../components/SeasonScatterTower"));
const YearHierarchicalBar = lazy(()=>import("../components/YearHierarchicalBar"));
const GradientEncoding    = lazy(()=>import("../components/GradientEncoding"));
const GroupedBarChart     = lazy(()=>import("../components/GroupedBarChart"));
const FeatureImportanceBar = lazy(()=>import("../components/FeatureImportanceBar"));
const LogitDotPlot    = lazy(()=>import("../components/LogitDotPlot"));
const RFConfusionHeatmap   = lazy(()=>import("../components/RFConfusionHeatmap"));

/* ---------- asset ---------- */
const HERO_IMG =
    "https://media.istockphoto.com/id/94146417/ko/%EC%82%AC%EC%A7%84/%EB%B8%8C%EB%9D%BC%EC%9A%B4-%EC%84%A4%EC%B9%98%EC%84%A0-%EB%A1%9C%EC%8A%A4%EC%95%A4%EC%A0%A4%EB%A0%88%EC%8A%A4-%EC%8A%A4%EB%AA%A8%EA%B7%B8.webp?b=1&s=612x612&w=0&k=20&c=Sk0iW4gTAmHXyBKs32rTWwAYLkGVCwiPcW6-td0Zpvo=";

/* ---------- animation util ---------- */
const fadeUp = keyframes`
  from {opacity:0; transform:translateY(40px);}
  to   {opacity:1; transform:translateY(0);}
`;

/* ---------- styled ---------- */
const Wrapper = styled.div`
  font-family: "Inter", "Noto Sans KR", sans-serif;
  background:#f9fafb; color:#222; overflow:hidden;
`;

const SnapRow = styled.main`
  height:100vh; display:flex; flex-wrap:nowrap;
  overflow-x:auto; overflow-y:hidden;
  scroll-snap-type:x mandatory; scroll-behavior:smooth;
  &::-webkit-scrollbar{display:none;}
`;

const SnapPanel = styled.section`
  flex:0 0 100vw; height:100vh; position:relative;
  scroll-snap-align:start;
  display:flex; flex-direction:column; justify-content:center;
  padding:0 1.5rem;
  overflow:hidden;
  opacity: 1 !important;
`;

const Hero = styled(SnapPanel)`
  align-items:center; background:url(${HERO_IMG}) center/cover no-repeat;
  &::after{content:""; position:absolute; inset:0; backdrop-filter:brightness(45%);}
`;
const HeroInner = styled.div`position:relative; text-align:center; z-index:1;`;
const HeroH1    = styled.h1`
  font:800 clamp(2rem,6vw,3.5rem)/1.1 Inter,sans-serif; color:#fff; margin:0;
`;
const HeroSub   = styled.p`
  color:#e4e4e4; font-size:clamp(1rem,2.5vw,1.375rem); margin-top:.75rem; z-index: 1;
`;
const StickyWorld = styled.div.attrs(({y, x}) => ({
    style: {
        transform: `translate3d(${x}px, -${y}px, 0)`
    }
}))`
  position: fixed;
  inset: 0;
  height: 100vh;
  pointer-events: none;
  z-index: 0;
  transition: transform 1s ease;
`;


const Headline = styled.h2`
  font:600 1.75rem/1.3 Inter,sans-serif; color:#fff; text-align:center; margin-bottom:.3rem; z-index: 1;
`;
const Sub = styled.p`
  text-align:center; color:#fff; margin-bottom:2rem; z-index: 1;`

const VizBox = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1280px;
  max-height: 85vh;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  & > * {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  @media(max-width: 768px) {
    max-height: 75vh;
  }
`;

/* Dot navigator */
const Dots = styled.ul`
  position:fixed; right:2rem; top:50%; transform:translateY(-50%);
  display:flex; flex-direction:column; gap:.7rem; list-style:none; z-index:10;
`;
const DotButton = styled.button`
  width:clamp(9px,1vw,12px); height:clamp(9px,1vw,12px); border-radius:50%;
  background: ${({ $active }) => $active ? "#34d399" : "#c5c5c5"};
  border:none; cursor:pointer; transition:background .25s;
  outline:2px solid transparent;
  &:focus-visible{outline-color:#34d399;}
`;

/* 상단 진행바(선택) */
const Progress = styled.div`
  position:fixed; top:0; left:0; height:4px; background:#34d399; z-index:12;
  width: ${({ $ratio }) => `${$ratio * 100}%`};
`;

const PanelBackdrop = styled.div`
  position: absolute;
  inset: 0;
  margin: auto;
  width: 88%;
  height: 85%;
  background: rgba(13, 15, 34, 0.75); /* 다크 네이비 + 투명도 */
  border-radius: 2rem;
  box-shadow: 0 4px 30px rgba(0,0,0,0.2);
  z-index: 0;
`;

/* ---------- util: vertical wheel → horizontal ---------- */
const useHorizontalWheel = ref=>{

    useEffect(()=>{
        if(!ref.current) return;
        const node=ref.current;
        const onWheel=e=>{
            if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
                node.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        };
        node.addEventListener("wheel",onWheel,{passive:false});
        return()=>node.removeEventListener("wheel",onWheel);
    },[ref]);

};

/* ---------- component ---------- */
export default function HomePage(){

    /* 패널 인덱스 & URL 매핑 */
    const order=[
        "one","two","three","four","five","six","seven",
        "eight","nine","ten","eleven","twelve",
        "thirteen","fourteen","fifteen", "sixteen" ,  "seventeen", "eighteen", "nineteen",
        "twenty","twentyone", "twentytwo", "twentythree"
    ];

    const scrollerRef = useRef(null);
    const panelsRef   = useRef([]);
    const [active,setActive]   = useState(0);
    const [stickyY,setStickyY] = useState(0);
    const [worldMapX, setWorldMapX] = useState(0);
    /* wheel */
    useHorizontalWheel(scrollerRef);

    /* world-map parallax */
    useEffect(()=>{
        const h=()=>setStickyY(Math.max(0,window.scrollY-350));
        window.addEventListener("scroll",h,{passive:true});
        return()=>window.removeEventListener("scroll",h);
    },[]);

    /* intersection */
    useEffect(()=>{
        const io=new IntersectionObserver(ents=>{
            ents.forEach(e=>{
                if(e.isIntersecting){
                    e.target.style.animationPlayState="running";
                    setActive(panelsRef.current.indexOf(e.target));
                }
            });
        },{threshold:.3});
        panelsRef.current.forEach(p=>io.observe(p));
        return()=>io.disconnect();
    },[]);

    /* query jump */
    useEffect(()=>{
        const idx=order.indexOf(new URLSearchParams(window.location.search).get("cont"));
        if(idx!==-1 && panelsRef.current[idx])
            panelsRef.current[idx].scrollIntoView({behavior:"instant"});
    },[]);

    useEffect(() => {
        const INITIAL_OFFSET = 1000;
        const PER_PANEL_SHIFT = -1000;
        if(active <4) {
            setWorldMapX(INITIAL_OFFSET + PER_PANEL_SHIFT * active);
        }

    }, [active]);

    /* panel ref setter */
    const setPanel=(el,idx)=>{ if(el) panelsRef.current[idx]=el; };

    /* dot click */
    const goto=idx=>{
        panelsRef.current[idx].scrollIntoView({behavior:"smooth"});
        window.history.replaceState(null,"",`?cont=${order[idx]}`);
    };

    /* ↔ 키보드 지원 */
    useEffect(()=>{
        const onKey=e=>{
            if(e.key==="ArrowRight" && active<order.length-1) goto(active+1);
            if(e.key==="ArrowLeft"  && active>0)             goto(active-1);
        };
        window.addEventListener("keydown",onKey);
        return()=>window.removeEventListener("keydown",onKey);
    },[active]);

    const [data, setData] = useState();
    const [topo, setTopo] = useState();

    useEffect(() => {
        d3.csv("/data/preprocessed_data.csv").then(setData);
        d3.json("/data/korea-sigungu-topo.json").then(setTopo);
    }, []);

    if (!data || !topo) return <div style={{textAlign:"center",margin:"4rem"}}>Loading data...</div>;


    return(
        <Wrapper>
            <Progress $ratio={active/(order.length-1)} />

            {/* world-map background */}
             <Suspense fallback={null}>
                <StickyWorld y={stickyY} x={worldMapX}>
                    <WorldMap />
                </StickyWorld>
            </Suspense>

            <SnapRow ref={scrollerRef}>

                {/* 1 Hero */}
                <Hero id="one" ref={el=>setPanel(el,0)}>
                    <HeroInner>
                        <HeroH1>Fine Dust with <span style={{color:"#34d399"}}>Social Intelligence</span></HeroH1>
                        <HeroSub>Welcome to our Data Analytics!</HeroSub>
                    </HeroInner>
                </Hero>

                {/* 2 Intro */}
                <SnapPanel id="two" ref={el=>setPanel(el,1)}>
                    <PanelBackdrop />
                    <Headline>Intro</Headline>
                    <Sub>국내 미세먼지 데이터를 분석·시각화한 결과를 공유합니다.</Sub>
                </SnapPanel>

                {/* TotalPM10 Map */}
                <SnapPanel id="three" ref={el=>setPanel(el,2)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <TotalPM10map data={data} topo={topo} />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* TotalTemp Map */}
                <SnapPanel id="four" ref={el=>setPanel(el,3)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <TotalTempmap data={data} topo={topo} />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* TotalRain Map */ }
                <SnapPanel id="five" ref={el=>setPanel(el,4)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <TotalRainmap data={data} topo={topo} />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* TotalCar Map */}
                <SnapPanel id="six" ref={el=>setPanel(el,5)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <TotalCarmap data={data} topo={topo} />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* KoreaPower Map */}
                <SnapPanel id="seven" ref={el=>setPanel(el,6)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <KoreaMapPower data={data} topo={topo} />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* SeasonalPM10 Map */}
                <SnapPanel id="eight" ref={el=>setPanel(el,7)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <SeasonalPM10map data={data} topo={topo} />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* Temperature Map */}
                <SnapPanel id="nine" ref={el=>setPanel(el,8)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <SeasonalTempmap data={data} topo={topo} />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* SeasonalRain Map */}
                <SnapPanel id="ten" ref={el=>setPanel(el,9)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <SeasonalRainmap data={data} topo={topo} />
                        </VizBox>
                    </Suspense>
                </SnapPanel>


                {/* SeasonalWind Map */}
                <SnapPanel id="eleven" ref={el=>setPanel(el,10)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <SeasonalWindmap data={data} topo={topo} />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* Yearly line */}
                <SnapPanel id="twelve" ref={el=>setPanel(el,11)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <GradientEncoding data={data} />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* Hierarchical */}
                <SnapPanel id="thirteen" ref={el=>setPanel(el,12)}>

                    <Suspense fallback={null}>
                        <VizBox>
                            <YearHierarchicalBar data = {data}/>
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* Region Month */}
                <SnapPanel id="fourteen" ref={el=>setPanel(el,13)}>

                    <Suspense fallback={null}>
                        <VizBox>
                            <RegionMonthMap data = {data}/>
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* Grouped */}
                <SnapPanel id="fifteen" ref={el=>setPanel(el,14)}>

                    <Suspense fallback={null}>
                        <VizBox>
                            <GroupedBarChart data = {data}/>
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/* Region Scatter */}
                <SnapPanel id="sixteen" ref={el=>setPanel(el,15)}>

                    <Suspense fallback={null}>
                        <VizBox>
                            <RegionScatterPlot />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                 {/* Season Scatter
                <SnapPanel id="seventeen" ref={el=>setPanel(el,16)}>

                    <Suspense fallback={null}>
                        <VizBox>
                            <SeasonScatterPlot data = {data}/>
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/*11 Non-summer scatter
                <SnapPanel id="eighteen" ref={el=>setPanel(el,17)}>
                    <PanelBackdrop />
                    <Suspense fallback={null}>
                        <VizBox>
                            <NonSummerScatterPlot/>
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/*12 Heatmap */}
                <SnapPanel id="nineteen" ref={el=>setPanel(el,18)}>

                    <Suspense fallback={null}>
                        <VizBox>
                            <SeoulSeasonHeatmap/>
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                {/*13 Scatter Tower */}
                <SnapPanel id="twenty" ref={el=>setPanel(el,19)}>

                    <Suspense fallback={null}><VizBox><SeasonScatterTower/></VizBox></Suspense>
                </SnapPanel>

                {/* 14 – RF Feature Importance (C-2) */}
                <SnapPanel id="twentyone" ref={el=>setPanel(el,20)}>

                    <Suspense fallback={null}>
                        <VizBox>
                            <FeatureImportanceBar />
                        </VizBox>
                    </Suspense>
                </SnapPanel>

                <SnapPanel id="twentytwo" ref={el=>setPanel(el,21)}>

                    <Suspense fallback={null}><VizBox><LogitDotPlot/></VizBox></Suspense>
                </SnapPanel>

                <SnapPanel id="twentythree" ref={el=>setPanel(el,22)}>

                    <Suspense fallback={null}><VizBox><RFConfusionHeatmap/></VizBox></Suspense>
                </SnapPanel>

            </SnapRow>

            {/* Dot navigator */}
            <Dots>
                {order.map((k,i)=>(
                    <li key={k}>
                        <DotButton
                            aria-label={`${i+1} / ${order.length} 화면으로 이동`}
                            $active={i===active}
                            onClick={()=>goto(i)}
                        />
                    </li>
                ))}
            </Dots>
        </Wrapper>
    );
}

