import React, { useState, useEffect } from "react";
import designersData from'../data/designers.json';

const Designers = () => {
  const [designers, setDesigners] = useState([]);

  useEffect(() => {
    setDesigners(designersData);
  }, []);

  return (
    <div className="container mt-5">
      {designers.map((designer, index) => (
        <div key={index}className="row mb-4"><div className="col-md-4"><img src={`/images/${designer.imageURL}`} alt={designer.name} className="img-fluid" /></div><div className="col-md-8"><h2>{designer.name}</h2><a href={designer.website} target="_blank" rel="noopener noreferrer">Website</a><p>{designer.about_me}</p></div></div>
      ))}
    </div>
  );
};

export default Designers;
