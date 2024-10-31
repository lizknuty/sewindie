import { Outlet, Link } from"react-router-dom";
import { useEffect } from"react";

const Layout = () => {
  useEffect(() => {
   const handleNavLinkClick = () => {
      const navbarToggler = document.querySelector('.navbar-toggler');
      const navbarCollapse = document.querySelector('.navbar-collapse');

      if (navbarToggler && navbarCollapse.classList.contains('show')) {
        navbarToggler.click();
      }
    };

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', handleNavLinkClick);
    });

    return() => {
      navLinks.forEach(link => {
        link.removeEventListener('click', handleNavLinkClick);
      });
    };
  }, []);

  return (
    <><nav className="navbar navbar-expand-lg navbar-light bg-light fixed-top"><div className="container-fluid"><Link className="navbar-brand d-flex align-items-center" to="/"><img src="/images/logo.png" alt="Pattern Closet Logo" height="40" className="me-2" /><span style={{ fontFamily: "'Qwitcher Grypen', cursive" }}>Pattern Closet</span></Link><button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation"><span className="navbar-toggler-icon"></span></button><div className="collapse navbar-collapse" id="navbarNav"><ul className="navbar-nav"><li className="nav-item"><Link className="nav-link" to="/patterns">Patterns</Link></li><li className="nav-item"><Link className="nav-link" to="/designers">Designers</Link></li><li className="nav-item"><Link className="nav-link" to="/contribute">Contribute</Link></li></ul></div></div></nav><div className="container" style={{ paddingTop: '70px' }}><Outlet /></div></>
  );
};

export default Layout;
