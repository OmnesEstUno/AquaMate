import React, { useState, useEffect } from 'react';
import AMHeader from "../header";
import AMFooter from "../footer";
import { Gallery } from './gallery/Gallery';

function HomePage() {

    const [headerClassName, setHeaderClassName] = useState(''); // State to manage header class name

    const handleScroll = () => {
        const mainContainer = document.getElementById('main');
        const scrollTop = mainContainer.scrollTop;

        // Check if scrolled to the top
        if (scrollTop === 0) {
            document.getElementById('header').classList.remove("not-at-top");
            document.getElementById('header-right').classList.remove("not-at-top");
            document.getElementById('title-A').classList.remove("not-at-top");
            document.getElementById('title-l').classList.remove("not-at-top");
            document.getElementById('title-r').classList.remove("not-at-top");
            document.getElementById('title-wrapper').classList.remove("not-at-top");

        } else {
            document.getElementById('header').classList.add("not-at-top");
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

    // Mark the header as being on the home page so the hero-mode CSS
    // (.header.at-home:not(.not-at-top)) kicks in. Removed on unmount so other
    // routes don't inherit hero styling.
    useEffect(() => {
        const header = document.getElementById('header');
        if (!header) return;
        header.classList.add('at-home');
        return () => header.classList.remove('at-home');
    }, []);


    return (
        <div>
            <AMHeader className={headerClassName}/>

            <main id={'main'} className="full-bleed-bg scroll-hidden">
                <section id="home" className="hero">
                    <h1>Welcome to Our Unified Aquarium Tool</h1>
                    <p>Discover the beauty of aquatic life and create your own underwater paradise.</p>
                </section>

                <Gallery />
            </main>
            <AMFooter/>
        </div>
    );
}

export default HomePage;
