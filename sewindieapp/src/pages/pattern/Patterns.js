import React, { useState, useEffect } from"react";
import patternsData from'../data/patterns.json';

const Patterns = () => {
  const [patterns, setPatterns] = useState([]);
  const [filteredPatterns, setFilteredPatterns] = useState([]);
  const [filters, setFilters] = useState({
    designer: "",
    fabricType: "",
    category: "",
  });

  useEffect(() => {
    setPatterns(patternsData);
    setFilteredPatterns(patternsData);
  }, []);

  useEffect(() => {
    let filtered = patterns;

    if (filters.designer) {
      filtered = filtered.filter(pattern => pattern.designer === filters.designer);
    }

    if (filters.fabricType) {
      filtered = filtered.filter(pattern => pattern.fabricType === filters.fabricType);
    }

    if (filters.category) {
      filtered = filtered.filter(pattern => pattern.category === filters.category);
    }

    setFilteredPatterns(filtered);
  }, [filters, patterns]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value,
    });
  };

  const uniqueDesigners = [...new Set(patterns.map(pattern => pattern.designer))];
  const uniqueFabricTypes = [...new Set(patterns.map(pattern => pattern.fabricType))];
  const uniqueCategories = [...new Set(patterns.map(pattern => pattern.category))];
  
  return (
    <div className="container mt-5"><div className="row mb-4"><div className="col-md-4"><label className="form-label">Filter by Designer</label><select
            className="form-select"
            name="designer"
            value={filters.designer}
            onChange={handleFilterChange}
          ><option value="">All Designers</option>
            {uniqueDesigners.map((designer, index) => (
              <option key={index}value={designer}>
                {designer}
              </option>
            ))}
          </select></div><div className="col-md-4"><label className="form-label">Filter by Fabric Type</label><select
            className="form-select"
            name="fabricType"
            value={filters.fabricType}
            onChange={handleFilterChange}
          ><option value="">All Fabric Types</option>
            {uniqueFabricTypes.map((fabricType, index) => (
              <option key={index}value={fabricType}>
                {fabricType}
              </option>
            ))}
          </select></div><div className="col-md-4"><label className="form-label">Filter by Category</label><select
            className="form-select"
            name="category"
            value={filters.category}
            onChange={handleFilterChange}
          ><option value="">All Categories</option>
            {uniqueCategories.map((category, index) => (
              <option key={index}value={category}>
                {category}
              </option>
            ))}
          </select></div></div><div className="row">
        {filteredPatterns.map((pattern, index) => (
          <div key={index}className="col-md-4"><div className="card mb-4"><img
                src={`/images/${pattern.imageURL}`}
                className="card-img-top"
                alt={pattern.name}
              /><div className="card-body"><h5 className="card-title">{pattern.name}</h5><p className="card-text">Designed by: {pattern.designer}</p></div></div></div>
        ))}
      </div></div>
  );
};

export default Patterns;

