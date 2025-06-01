import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// 페이지들 임포트
import HomePage from './pages/HomePage';

// 공통 링크 스타일
const navLinkStyle = {
    textDecoration: 'none',
    color: '#333',
    fontWeight: 'bold'
};

// 푸터 링크 스타일
const footerLinkStyle = {
    textDecoration: 'none',
    color: '#777'
};

function App() {
    const [showNav, setShowNav] = useState(true);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 100) {
                setShowNav(false);
            } else {
                setShowNav(true);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <Router>
            <div style={{ fontFamily: 'sans-serif', backgroundColor: '#0d0f22', color: '#fff', minHeight: '100vh' }}>

                {/* 상단 네비게이션 바 */}

                {/* 메인 콘텐츠 */}
                <main style={mainContentStyle}>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                    </Routes>
                </main>

            </div>
        </Router>
    );
}

// 스타일 정의
const headerStyle = {
    position: 'fixed',
    top: 0,
    left: '0.5%',
    width: '95%',
    backgroundColor: '#fff',
    borderBottom: '1px solid #eee',
    padding: '1em 2em',
    zIndex: 1000
};



const logoStyle = {
    display: 'flex',
    alignItems: 'center'
};

const navStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    paddingRight: '2em', // 오른쪽 패딩 추가
};

const navLinksStyle = {
    listStyle: 'none',
    display: 'flex',
    gap: '1rem', // gap을 줄여서 화면에 맞게 조정
    margin: 0,
    marginRight: '2%', // marginRight로 수정
    padding: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
};

const responsiveNavStyle = {
    '@media (max-width: 768px)': {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0.5rem', // 작은 화면에서 gap 줄이기
    },
};



const mainContentStyle = {
    padding: '6em 2em 2em',  // 헤더 높이만큼 상단 패딩 추가
};

const footerStyle = {
    backgroundColor: '#fff',
    borderTop: '1px solid #eee',
    padding: '1em 2em',
    textAlign: 'center',
};

export default App;
