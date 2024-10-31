import React from "react";
import"bootstrap/dist/css/bootstrap.min.css";
import { Carousel } from "react-bootstrap";
import"../App.css";

const Home = () => {
  return (
    <div className="container mt-5"><div className="row"><div className="col-md-6"><h1>Welcome to Pattern Closet</h1><p>Your pattern library, organized and connected.</p></div><div className="col-md-6"><img src="/images/home.jpg" alt="Home" className="img-fluid" /></div></div>

<div className="mt-5"><h2 className="text-center">Featured Designers</h2></div>

<Carousel className="mt-5"><Carousel.Item><img
            className="d-block w-100"
            src="/images/featured-designer1.jpg"
            alt="First slide"
          /><Carousel.Caption><h3>Jane Doe</h3><p>Innovative designer known for modern apparel.</p></Carousel.Caption></Carousel.Item><Carousel.Item><img
            className="d-block w-100"
            src="/images/featured-designer2.jpg"
            alt="Second slide"
          /><Carousel.Caption><h3>John Smith</h3><p>Bringing a fresh perspective to menswear.</p></Carousel.Caption></Carousel.Item><Carousel.Item><img
            className="d-block w-100"
            src="/images/featured-designer3.jpg"
            alt="Third slide"
          /><Carousel.Caption><h3>Emily Johnson</h3><p>Specialist in sustainable fashion.</p></Carousel.Caption></Carousel.Item></Carousel></div>
  );
};

export default Home;
