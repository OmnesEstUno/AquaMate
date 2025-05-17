import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../home/home.css';
import AMHeader from "../header";
import AMFooter from "../footer";

function AboutUs(){
    const navigate = useNavigate();

    const handleAboutClick = (member) => {
        navigate(`/about/${encodeURIComponent(member.toLowerCase().split(' ')[0])}`);
    }

    useEffect(() => {
        document.getElementById("title-A").classList.add("not-at-top")
        document.getElementById("title-l").classList.add("not-at-top")
        document.getElementById("title-r").classList.add("not-at-top")
        document.getElementById("title-wrapper").classList.add("not-at-top")
    }, []);

    return (
        <div>
            <AMHeader/>
            <main>
                <div className={"team-about"}>
                    <h1>About Tetra Team</h1>
                    <p>Welcome to the Tetra Team's About Page. Our team is composed of dedicated and passionate members
                        from San Francisco State University. Each member brings unique skills and perspectives to the
                        team, driving our projects towards success.</p>
                    <p>We are team three of CSC648-04</p>
                    <ul className={'team-members'}>
                        <li className={'team-member'}><a
                            id={'elliot'}
                            onClick={() =>
                                handleAboutClick(document.getElementById('elliot').innerText)}>
                            Elliot Warren - Team Lead
                        </a></li>
                        <li className={'team-member'}><a
                            id={'inderpaul'}
                            onClick={() =>
                                handleAboutClick(document.getElementById('inderpaul').innerText)}>
                            Inderpaul Bhander - Scrum Master
                        </a></li>
                        <li className={'team-member'}><a
                            id={'miguelangel'}
                            onClick={() =>
                                handleAboutClick(document.getElementById('miguelangel').innerText)}>
                            Miguelangel Vargas - Front-end Lead
                        </a></li>
                        <li className={'team-member'}><a
                            id={'sukrit'}
                            onClick={() =>
                                handleAboutClick(document.getElementById('sukrit').innerText)}>
                            Sukrit Dev Dhawan - Back-end Lead
                        </a></li>
                        <li className={'team-member'}><a
                            id={'mohammed'}
                            onClick={() =>
                                handleAboutClick(document.getElementById('mohammed').innerText)}>
                            Mohammed Deeb - Git Master
                        </a></li>
                        <li className={'team-member'}><a
                            id={'citlalin'}
                            onClick={() =>
                                handleAboutClick(document.getElementById('citlalin').innerText)}>
                            Citlalin Galvan - Individual Contributer
                        </a></li>
                        <li className={'team-member'}><a
                            id={'naing'}
                            onClick={() =>
                                handleAboutClick(document.getElementById('naing').innerText)}>
                            Naing Htet - Individual Contributer
                        </a></li>
                    </ul>
                </div>
                <div className={'schedule-wrapper'}>
                    <h1>Team Meeting Schedule</h1>
                    <a href="https://www.when2meet.com/?23580210-OQwEA">Team Tetra Weekly Availabilities</a>
                </div>
                <div className={'discord-wrapper'}>
                    <h1>Team Communication Channel</h1>
                    <a href="https://discord.gg/x7Ses8shk7">Team Tetra Discord</a>
                </div>

                <AMFooter/>
            </main>
        </div>

    )
}

export default AboutUs;