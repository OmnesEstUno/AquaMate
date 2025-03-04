import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from './home/home.js';
import InfoPage from './info_page/InfoPage.js';
import BuilderTool from './builder_tool/builder_tool.js';
import Favorites from './builder_tool/favorites.js';
import AboutUs from './about/about_us.js';
import AboutPerson from './about/about_person.js';
import EasterEgg from './easter_egg.js';
import { FavoritesProvider }  from './builder_tool/favorites_provider';
import { SearchProvider } from './search/search_provider';
import './home/home.css';
import './builder_tool/builder_tool.css';

function App() {
    const [message, setMessage] = useState('loading...');

    useEffect(() => {
        fetch(`http://localhost:8080/test`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => setMessage(data.message))
            .catch(err => {
                console.error("Failed to fetch data from backend:", err);
                setMessage("Failed to connect to the backend.");
            });
    }, []);

    return (
        <FavoritesProvider>
            <SearchProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/buildertool" element={<BuilderTool />} />
                        <Route path="/info/:searchTerm" element={<InfoPage />} />
                        <Route path="/favorites" element={<Favorites />} />
                        <Route path="/aboutus" element={<AboutUs />} />
                        <Route path="/about/:searchTerm" element={<AboutPerson />} />
                        <Route path="/easteregg" element={<EasterEgg />} />
                    </Routes>
                </BrowserRouter>
            </SearchProvider>
        </FavoritesProvider>
    );
}

export default App;