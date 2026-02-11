import pp from '../assets/logo_BDRap.png'

function Card2(props){
    return( 
        <div className="card-section">  
            <div className="card-container">
                <div className="card2">
                    <img src={pp} alt="Profile of the card." className="ci"/>
                    <p className="title">{props.label}</p>
                    <p className="des">
                       {props.des}
                    </p>
                </div>

                <p className="text">
                   {props.txt}
                </p>
            </div>
        </div>
    );
}

export default Card2;
