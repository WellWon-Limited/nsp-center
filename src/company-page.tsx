import { CompanyContent } from './company-content';
import './company-page.css';

// Only the company article changes. App owns the existing header, footer and bottom navigation.
export function CompanyPage(){return <div className="company-page company-page--nature" data-ds-id="page-company"><CompanyContent/></div>;}
