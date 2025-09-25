// @ts-nocheck
import type { Bus, Location } from "../types";
import { locations } from "../constants"; 
import axios from "axios";
import { log } from "console";

const isDevelopment = process.env.NODE_ENV === 'development' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

const STOP_CODE_MAP: { [key: string]: string } = {
  'JPR': 'Jaipur', 'JDH': 'Jodhpur', 'KTH': 'Kota', 'MAB': 'Mount Abu',
  'DLH': 'Delhi', 'CHGH': 'Chandigarh', 'BRLI': 'Bareilly', 'KTP': 'Kotputli',
  "KKR": "KEKRI", "NGR": "NAGOUR", "SNG": "SANGANER", "BHL": "BHILWARA",
  "AJM": "AJMER", "ALD": "ALWAR", "BKN": "BIKANER", "JSM": "JASMAND",
  "JLN": "JALORE", "JSG": "JHUNJHUNU", "KSR": "KISHANGARH", "LKR": "LAKHERI",
  "MLD": "MALDA", "PBL": "PALI", "RNT": "RANTHAMBORE", "SML": "SAMBALPUR",
  "TNR": "TONK", "TPT": "TAPUKARA", "UDR": "UDAIPUR", "VNS": "VANAS",
  "BGR": "BAGRU", "BHR": "BHARATPUR", "DHR": "DHAR", "GGR": "GURUGRAM",
  "HVR": "HAVERI", "KLR": "KALWAR", "KLRD": "KALWAR ROAD", "LUN": "LUNAWADA",  
  "MGR": "MANGROL", "MGRD": "MANGROL ROAD", "MGRN": "MANGROL NAGAR", "MGRP": "MANGROL PUL",  
  "MGRV": "MANGROL VILLAGE", "MGRW": "MANGROL WARD", "MGRZ": "MANGROL ZONE",
  "MGRS": "MANGROL STATION", "MGRB": "MANGROL BAZAR", "MGRM": "MANGROL MARKET",  
  "MGRH": "MANGROL HOSPITAL", "HRD": "HARIDWAR", "LKO": "LUCKNOW", "MUS": "MUSSOORIE",
  "RGR": "RAGHOGARH", "RGRD": "RAGHOGARH ROAD"
};

const getXmlValue = (element: Element, tagName: string): string => {
  const node = element.querySelector(tagName);
  return node ? node.textContent || '' : '';
};

const mapLocationToLocationObject = (locationName: string): Location | undefined => {
  const normalizedName = locationName.toLowerCase().trim();
  const foundKey = Object.keys(locations).find(
    (key) => typeof locations[key] === 'object' && locations[key].en.toLowerCase() === normalizedName
  );
  return foundKey ? locations[foundKey] : undefined;
};

const mapXmlServiceToBus = (serviceXml: Element): Bus => {
    const serviceId = getXmlValue(serviceXml, 'serviceId');
    const routeName = getXmlValue(serviceXml, 'routeName') || "RSRTC Bus";
    const busType = getXmlValue(serviceXml, 'busType') || "Express";
    
    const fromStopCD = getXmlValue(serviceXml, 'fromStopCD');
    const toStopCD = getXmlValue(serviceXml, 'toStopCD');

    const departureTime = getXmlValue(serviceXml, 'departureTime'); 
    const arrivalTime = getXmlValue(serviceXml, 'arrivalTime'); 
    const duration = 'N/A'; 
    
    const originName = STOP_CODE_MAP[fromStopCD] || fromStopCD;
    const destinationName = STOP_CODE_MAP[toStopCD] || toStopCD;
    
    const fromLocation = mapLocationToLocationObject(originName) || { en: originName, hi: originName };
    const toLocation = mapLocationToLocationObject(destinationName) || { en: destinationName, hi: destinationName };

    return {
        id: serviceId,
        name: routeName,
        type: busType,
        from: fromLocation,
        to: toLocation,
        departureTime: departureTime.substring(0, 5),
        arrivalTime: arrivalTime.substring(0, 5), 
        duration: duration,
        fare: 0, 
        platform: 1, 
        route: [], 
    };
};

//make api req
const makeApiRequest = async (SOAP_ENVELOPE: string) => {
    try {
        const response = await axios.post(
            isDevelopment 
                ? "/api/rsrtc/TimetableServices/VtsService"
                : "/api/rsrtc/TimetableServices/VtsService",
            SOAP_ENVELOPE,
            {
                headers: {
                    "Content-Type": "text/xml;charset=UTF-8",
                    SOAPAction: '"getAvailableServices"',
                },
                timeout: 10000,
            }
        );

        console.log("Is development :", isDevelopment);
        console.log("RSRTC API response :", response);
        
        return response.data;
    } catch (error: any) {
        if (error.response) throw new Error(`HTTP error! status: ${error.response.status}`);
        else if (error.request) throw new Error("No response received from API");
        else throw new Error(`Axios error: ${error.message}`);
    }
};

const isConnectionError = (xmlText: string): boolean => {
    return xmlText.includes('Connection Link Error !') || xmlText.includes('errorReason');
};

export const getAvailableServices = async (fromCity: string, toCity: string): Promise<Bus[]> => {
    const currentDate = new Date();
    console.log("currentDate:", currentDate);
    
    const dateOfJourney = `${String(currentDate.getDate()).padStart(2,"0")}/${String(currentDate.getMonth()+1).padStart(2,"0")}/${currentDate.getFullYear()}`;
    console.log("dateOfJourney:", dateOfJourney);
    
    const depotCd = fromCity.toLowerCase().includes("jaipur") ? "JPR" : "JDR"; 
    console.log("depotCd:", depotCd);

    const SOAP_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.rsrtc.trimax.com/">
        <soapenv:Header/>
        <soapenv:Body>
        <ser:getAvailableServices>
            <AvailableServiceRequest>
            <authentication>
                <userName>tmt</userName>
                <password>Time@321#</password>
                <userType>1</userType>
            </authentication>
            <dateOfJourney>${dateOfJourney}</dateOfJourney>
            <depotCd>${depotCd}</depotCd>
            </AvailableServiceRequest>
        </ser:getAvailableServices>
        </soapenv:Body>
    </soapenv:Envelope>`;

    console.log("SOAP_ENVELOPE:", SOAP_ENVELOPE);
    

    try {
        const maxAttempts = 3;
        let xmlText = '';
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`API call attempt ${attempt}...`);
            xmlText = await makeApiRequest(SOAP_ENVELOPE);
            console.log("Received XML response:", xmlText);
            
            if (!isConnectionError(xmlText)) break;
            console.warn(`Connection error detected, retrying...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 500)); // incremental delay
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        console.log("Parsed XML Document:", xmlDoc);
        

        const errorReason = xmlDoc.querySelector('errorReason');
        if (errorReason && errorReason.textContent) {
            console.warn("API returned error:", errorReason.textContent);
            return [];
        }

        const serviceNodes = xmlDoc.querySelectorAll('service');
        if (serviceNodes.length === 0) {
            console.warn("No 'service' nodes found in XML response.", xmlText);
            return [];
        }

        const normalizedToCity = toCity.toLowerCase().trim();

        const foundBuses = Array.from(serviceNodes)
            .map(mapXmlServiceToBus)
            .filter(bus => bus.to.en.toLowerCase().trim() === normalizedToCity)
            .sort((a, b) => {
                const departureA = new Date(`2000/01/01 ${a.departureTime}`);
                const departureB = new Date(`2000/01/01 ${b.departureTime}`);
                return departureA.getTime() - departureB.getTime();
            });

        return foundBuses;

    } catch (error) {
        console.error("Failed to fetch RSRTC services:", error);
        return [];
    }
};
