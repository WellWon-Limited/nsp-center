import {Icon} from './ui';
import './home-care.css';

// Keep the same card on home, intake and marathon; retain the test's return context.
export function RecommendationCard({from}:{from?:'plan'|'marathon'}){
 return <a className="care-card care-card--reflection recommendation-card" href={from?`/diagnostic-test/?from=${from}`:'/diagnostic-test/'} data-ds-id={from?`${from}-questionnaire`:'home-care-questionnaire'}><div className="care-card-copy"><h2>Что подойдёт<br/>именно вам?</h2><p>Тест-рекомендации: несколько вопросов о самочувствии и подборка с объяснением, зачем это вам.</p></div><div className="care-card-footer"><span className="care-card-action">Пройти тест <Icon name="arrow" size={20}/></span><span className="care-question-dots" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}/>)}</span></div></a>;
}
