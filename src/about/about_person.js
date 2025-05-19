import React, { useEffect, useState } from 'react';
import Json from './about.json';
import '../home/home.css';
import AMHeader from "../header";
import AMFooter from "../footer";

function AboutPerson(){
    const person = window.location.href.split("/").at(-1);
    const [personDetails, setPersonDetails] = useState(person);
    var ran = false;

    useEffect(() => {
        if (!ran) {
            //import image based on person
            import(`../assets/${person}.jpg`).then(image => {
                const personImage = document.createElement("img");
                personImage.src = image.default;
                personImage.classList.add("person-image");
                document.getElementById("image").appendChild(personImage);
            })
                .catch(error =>{
                    console.log(error);
                });

            // Filter through JSON data to find the person
            const foundPerson = Json.team_members.find(member =>
                member.name.toLowerCase().split(' ')[0] === person
            );

            // Update personDetails if a person is found
            if (foundPerson) {
                setPersonDetails(foundPerson);
            }
            ran = true;
            document.getElementById('title-A').classList.add("not-at-top");
            document.getElementById('title-l').classList.add("not-at-top");
            document.getElementById('title-r').classList.add("not-at-top");
            document.getElementById('title-wrapper').classList.add("not-at-top");
        }
    }, [person]);

    // Render loading state if personDetails is null
    if (!personDetails) {
        return <div>Loading...</div>;
    }

    return(
        <div >
            <AMHeader/>
            <main className={"person-main"}>
                <div className={"person-intro"}>
                    <h1 className={'person-position'}>{personDetails.position}</h1>
                    <div id={"image"} className={'p-img-container'}></div>
                </div>
                <div className={"person-about"}>
                    <h1 className={"person-name"}>{personDetails.name}</h1>
                    <p className={'about-person'}>{personDetails.about}</p>
                </div>
            </main>
            <AMFooter/>
        </div>
    )
}

export default AboutPerson;