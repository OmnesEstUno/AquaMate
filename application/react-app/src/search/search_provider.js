import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the context
const SearchContext = createContext('');

export const SearchProvider = ({ children }) => {
    const [searchResults, setSearchResults] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const search = () => {
	    const url = 'https://aquamate.me/cards?search=&page=0&limit=8';
            //const url = `http://localhost:8080/search?search=${encodeURIComponent(searchTerm)}`;
            fetch(url)
                .then(response => response.json())
                .then(data => setSearchResults(data))
                .catch(error => console.error('Error fetching search results:', error));
        };

        if (searchTerm) {
            search();
        }
    }, [searchTerm]);

    return (
        <SearchContext.Provider value={{ searchResults, searchTerm, setSearchTerm }}>
            {children}
        </SearchContext.Provider>
    );
};

export const useSearch = () => useContext(SearchContext);
