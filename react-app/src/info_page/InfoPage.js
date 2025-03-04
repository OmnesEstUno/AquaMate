import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './InfoPage.css';
import AMHeader from "../header";
import '../header';
import AMFooter from "../footer"; // CSS File

function InfoPage() {
    const { searchTerm } = useParams();
    const [itemDetails, setItemDetails] = useState(null);

    useEffect(() => {

        // Change for local or server
        const url = `https://aquamate.me/search?search=${encodeURIComponent(searchTerm)}`;
       //const url = `http://localhost:8080/search?search=${encodeURIComponent(searchTerm)}`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data && data.length > 0) {
                    setItemDetails(data[0]);
		    document.getElementById("title-A").classList.add("not-at-top");
        	    document.getElementById("title-l").classList.add("not-at-top");
        	    document.getElementById("title-r").classList.add("not-at-top");
        	    document.getElementById("title-wrapper").classList.add("not-at-top");
                } else {
                    throw new Error('Item not found');
                }
            })
            .catch(error => {
                console.error('Error fetching item details:', error);
            });
    }, [searchTerm]);

    if (!itemDetails) return <div>Loading...</div>;

    return (
        <main className="info-page-container">
            <AMHeader/>
            <div className="info-page-body">
                <div className="info-page-image-section">
                    <img src={itemDetails.photo} alt={`Image of ${itemDetails.commonName}`} className="info-page-main-image" />
                </div>
                <div className="info-page-details-section">
                    <div className="info-page-details">
                        <h1 className="info-page-main-name">{itemDetails.commonName}</h1>
                        <h2 className="info-page-sci-name">"{itemDetails.scientificName}"</h2>
                        <p className="info-page-description">
                            {itemDetails.description}
                            Description
                        </p>
                    </div>
                </div>
            </div>
            <div className="info-page-notes-section">
                <div className="info-page-notes">Notes Area</div>
                <div className="info-page-notes">Notes Area</div>
            </div>
            <AMFooter/>
        </main>
    );
}

export default InfoPage;
