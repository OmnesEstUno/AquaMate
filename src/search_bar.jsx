// SearchBar.js
import React from 'react';
import BuilderTool from './builder_tool/builder_tool';
import './builder_tool/builder_tool'

const SearchBar = ({ searchTerm, setSearchTerm }) => {
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  return (
    <input
      type="text"
      placeholder="Search..."
      value={searchTerm}
      onChange={handleSearchChange}
    />
  );
};

export default SearchBar;
