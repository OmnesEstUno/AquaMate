import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the context
const SearchContext = createContext('');

export const SearchProvider = ({ children }) => {
    const [searchResults, setSearchResults] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!searchTerm || !searchTerm.trim()) {
            setSearchResults([]);
            return;
        }
        const controller = new AbortController();
        const url = `https://aquamate-worker.elliotjwarren.workers.dev/api/search?q=${encodeURIComponent(searchTerm.trim())}`;
        fetch(url, { signal: controller.signal })
            .then(response => response.json())
            .then(data => {
                if (data && data.success && Array.isArray(data.results)) {
                    setSearchResults(data.results);
                } else {
                    setSearchResults([]);
                }
            })
            .catch(error => {
                if (error.name !== 'AbortError') console.error('Error fetching search results:', error);
            });
        return () => controller.abort();
    }, [searchTerm]);

    return (
        <SearchContext.Provider value={{ searchResults, searchTerm, setSearchTerm }}>
            {children}
        </SearchContext.Provider>
    );
};

export const useSearch = () => useContext(SearchContext);
