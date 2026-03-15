import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Don't reset scroll on messages route — chat handles its own scroll
    if (pathname.includes('/messages')) return;
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;