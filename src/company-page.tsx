import {useEffect,useState} from 'react';
import {homeStoryReturn} from './home-story-navigation.mjs';
import { CompanyContent } from './company-content';
import './company-page.css';

// Only the company article changes. App owns the existing header, footer and bottom navigation.
export function CompanyPage(){const [homeLink,setHomeLink]=useState(false);useEffect(()=>{setHomeLink(Boolean(homeStoryReturn(location.href)));},[]);return <div className="company-page company-page--nature" data-ds-id="page-company"><CompanyContent homeLink={homeLink}/></div>;}
