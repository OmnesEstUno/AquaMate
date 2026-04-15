import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash'; // Ensure lodash is installed or implement your own debounce function
import { useSearch } from '../search/search_provider';
import { useFavorites } from '../builder_tool/favorites_provider';
import AMHeader from "../header";
import AMFooter from "../footer";

function HomePage() {

    const [images, setImages] = useState([]);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [headerClassName, setHeaderClassName] = useState(''); // State to manage header class name
    const navigate = useNavigate();
    const { searchResults } = useSearch()
    const mission = 'AquaMate aims to provide a singular place where someone of any experience level of fish keeping can go to obtain details about fish they are interested in caring for.';

    const handleScroll = () => {
        const mainContainer = document.getElementById('main');
        const scrollTop = mainContainer.scrollTop;

        // Check if scrolled to the top
        if (scrollTop === 0) {
            document.getElementById('header-right').classList.remove("not-at-top");
            document.getElementById('title-A').classList.remove("not-at-top");
            document.getElementById('title-l').classList.remove("not-at-top");
            document.getElementById('title-r').classList.remove("not-at-top");
            document.getElementById('title-wrapper').classList.remove("not-at-top");

        } else {
            document.getElementById('header-right').classList.add("not-at-top");
            document.getElementById('title-A').classList.add("not-at-top");
            document.getElementById('title-l').classList.add("not-at-top");
            document.getElementById('title-r').classList.add("not-at-top");
            document.getElementById('title-wrapper').classList.add("not-at-top");

        }
    };


    /*
     * checks for scolling happening within the "main" element
     */
    useEffect(() => {
        // Add event listener for scrolling
        const mainContainer = document.getElementById('main');
        mainContainer.addEventListener('scroll', handleScroll);

        // Clean up event listener on unmount
        return () => {
            mainContainer.removeEventListener('scroll', handleScroll);
        };
    }, []);


    // Fetch initial 8 images
    const fetchInitialImages = useCallback(() => {
        document.getElementById('header-right').classList.add('at-home');
        // Change for local or server
        const url = 'https://aquamate-worker.elliotjwarren.workers.dev/api/images/freshwater/1';
        fetchImages(url);
    }, []);

    // Fetch more images
    const fetchMoreImages = useCallback(() => {
        // Change for local or server
        const workerPage = page + 1; // Convert 0-based to 1-based for Worker
        console.log("current page: " + workerPage);
        const url = `https://aquamate-worker.elliotjwarren.workers.dev/api/images/freshwater/${workerPage}`;
        fetchImages(url);
    }, [page]);

    // Function to fetch images from the API
    const fetchImages = (url) => {
        if (loading || !hasMore) return;

        setLoading(true);
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (!data.success || data.items.length === 0) {
                    setHasMore(false);
                    return;
                }
                setImages(prevImages => [...prevImages, ...data.items]);
                setPage(prevPage => prevPage + 1);
                
                // Stop if we've reached the end
                if (data.page >= data.totalPages) {
                    setHasMore(false);
                }
            })
            .catch(error => {
                console.error('Error fetching images:', error);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const firstRun = React.useRef(true);

    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;
            fetchInitialImages();
        }
    }, [fetchInitialImages]);

    useEffect(() => {
        const mainContainer = document.getElementById('main');

        const handleScroll = debounce(() => {
            if (
                mainContainer.scrollTop + mainContainer.clientHeight >=
                mainContainer.scrollHeight - 10 &&
                !loading
            ) {
                fetchMoreImages();
            }
        }, 100);

        mainContainer.addEventListener('scroll', handleScroll);
        return () => mainContainer.removeEventListener('scroll', handleScroll);
    }, [fetchMoreImages, loading]);


    const handleResultClick = (commonName) => {
        navigate(`/info/${encodeURIComponent(commonName)}`);
    };

    function FavoriteButton({ category, item }) {
        const { isFavorite, favoriteSwitch } = useFavorites();

        return (
            <button
                className={`fav-btn ${isFavorite(category, item.id) ? 'highlighted' : ''}`}
                onClick={(e) => {
                    e.stopPropagation(); // This stops the click event from bubbling up to the parent
                    favoriteSwitch(category, item);
                }}
            >
                {isFavorite(category, item.id) ? '' : ''}
            </button>
        );
    }


    return (
        <div>
            <AMHeader className={headerClassName}/>

            <main id={'main'}>
                <section id="home" className="hero">
                    <h1>Welcome to Our Unified Aquarium Tool</h1>
                    <p>Discover the beauty of aquatic life and create your own underwater paradise.</p>
                    <a className={'sparkley last'} onClick={() =>document.getElementById('mission').innerText=mission}>What is it?</a>
                    <p id={'mission'}></p>
                </section>
                <section id="search-results" className="search-results">
                    {searchResults && searchResults.length > 0 && (
                        <div className="gallery-container" id='gallery'>
                            <h1 className="gallery-header">Search Results</h1>
                            <div className="gallery">
                                {searchResults.map((result, index) => (
                                    <div key={index} onClick={() => handleResultClick(result.commonName)} style={{cursor: 'pointer'}}>
                                        <img src={result.image_url} alt={result.commonName} width="640" height="480"/>
                                        <span>{result.commonName}</span>
                                        <span>"{result.scientificName}"</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <section className="gallery-container">
                    <h1 className="gallery-header">Gallery</h1>
                    <div className="gallery">
                        {images.map((image, index) => (
                            <div className={'card'}
                                key={index}
                                onClick={() => handleResultClick(image.commonName)}
                                style={{cursor: 'pointer'}}>
                                <img
                                    src={image.image_url}
                                    alt={image.commonName}
                                    width="640"
                                    height="480"/>
                                <div className={'card-info'}>
                                    <span>{image.commonName}</span>
                                    <FavoriteButton category={image.category || image.Category} item={image} />
                                </div>
                            </div>
                        ))}
                        {loading && <p>Loading...</p>}
                    </div>
                </section>
            </main>
            <AMFooter/>
        </div>
    );
}

export default HomePage;
