//---SEBAL-Specific-Constants
const sigma = 5.67 * Math.pow(10,-8); // Boltzman Constant
//---Astronomy-Specific-Constants
const perihelion = 2; //The day in January of the perihelion, used for distance calculation
const ast_a = 1.496 * Math.pow(10,11); //Earth's semi-major axis
const ast_e = .0167; //Earth's eccentricity
const airTemp = 294.25; // Air temperature at the time of capture
const heightGround = .05; //m
const heightAir = 1.8; //m
const windSpeed = 3.6; //m/s
const heightWindSensor = 1.8; //m
const plantHeightAvg = 2; //m
const airDensity = 1; //kg/m^2
const zenithAngle = .0311;
const frictionVelocityU = .41*windSpeed/Math.log(heightWindSensor/.12*plantHeightAvg);
const thermalMapping = [299.1,315.1];
// --- Predeclaration ---
let tedData;

let nearInfared;
let rgb;

let imgW;
let imgH;

let nirImage;
let thermalImage;
let ndviImage;
let soilImage;
let rnImage;
let soilFluxImage;
// --- Class Definition and Supporting Functions
class GeoData{
  constructor(date){
    let doy = date.getDOY();
    this.solarDeclination = -1 * Math.asin(.39779 * Math.cos(.98565 * (doy + 10) + 1.914 * Math.sin(.98565 * (doy - 2))));
    this.solarDistance = (ast_a * (1-Math.pow(ast_e,2)))/(1+(ast_e * Math.cos((365.25/360) * (doy-perihelion))))/(1.496*Math.pow(10,11));
    this.solarConductivity = .75 + 2*Math.pow(10,-5)*1511;
    this.solarIncidence = zenithAngle;
    this.temperature = airTemp;
  }
  solarIncToTensor(){
    return tf.scalar(this.solarInclination);
  }
  solarDistToTensor(){
    return tf.scalar(this.solarDistance);
  }
  solarCondToTensor(){
    return tf.scalar(this.solarConductivity);
  }
  solarIncToTensor(){
    return tf.scalar(this.solarIncidence);
  }
}

function makeImage(w,h,pixArr){
  let tempImage = createImage(w,h);
  for(let y=0;y<imgH;y++){
    for(let x=0;x<imgW;x++){
      tempImage.set(x,y,pixArr[x+y*w]);
    }
  }
  tempImage.updatePixels();
  return tempImage;
}

const mapTensor = (tensor,oldMin,oldMax,newMin,newMax) => tensor.sub(oldMin).mul(newMax-newMin).div(oldMax-oldMin).add(newMin);

Date.prototype.isLeapYear = function() {
    var year = this.getFullYear();
    if((year & 3) != 0) return false;
    return ((year % 100) != 0 || (year % 400) == 0);
};
Date.prototype.getDOY = function() {
    var dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var mn = this.getMonth();
    var dn = this.getDate();
    var dayOfYear = dayCount[mn] + dn;
    if(mn > 1 && this.isLeapYear()) dayOfYear++;
    return dayOfYear;
};

// --- Pre-Initialization Asset Fetching---
function preload(){
  nearInfared = loadImage('composite2.jpg'); // Used for NDVI, LAI (uses SAVI with ln()), and SAVI, and for T_s.
  rgb = loadImage('RGBoutput2.jpg'); // Alpha or albedo
}

// --- p5 Initialization ---
function setup() {
  // --- Misc Geologic Data ---
  tedData = new GeoData(new Date('October 10, 2018'));

  imgW = nearInfared.width;
  imgH = nearInfared.height;
  createCanvas(500,636);

  // --- Instanciate the ECMAScript ImageData Class for Tensorflow ---
  let nirReds = new ImageData(nearInfared.width,nearInfared.height); // Use in NDVI/SAVI
  let nirNIR = new ImageData(nearInfared.width,nearInfared.height); // Use in NDVI/SAVI
  let thermalTs = new ImageData(nearInfared.width,nearInfared.height); // Used for T_s
  let albedoImg = new ImageData(nearInfared.width,nearInfared.height); // Used for albedo from RGB.

  // --- Get all the necessary images and their respective matricies ---
  nearInfared.loadPixels();

  // --- Assign the respective channel values to the ImageData objects above ---
  for(let c=0;c<nearInfared.pixels.length;c+=4){
    nirReds.data[c] = nearInfared.pixels[c];
    thermalTs.data[c] = nearInfared.pixels[c+2];
    nirNIR.data[c] = nearInfared.pixels[c+1];
    nirReds.data[c+1] = 0;
    nirReds.data[c+2] = 0
    nirReds.data[c+3] = 0;
    nirNIR.data[c+1] = 0;
    nirNIR.data[c+2] = 0
    nirNIR.data[c+3] = 0;
    thermalTs.data[c+1] = 0;
    thermalTs.data[c+2] = 0;
    thermalTs.data[c+3] = 0;
  }

  // --- Assign albedo Pixels ---
  rgb.loadPixels();
  albedoImg.data = rgb.pixels;

  // --- TensorFlow Garbage Collect ---
  tf.tidy(() => {
    console.log("Starting Process.");
    // --- Create the tensors ---
    /*-Destroy-*/ let redsTensor = tf.squeeze(tf.fromPixels(nirReds,1).toFloat().div(255)); // The red values
    /*-Keep-*/ let nirTensor = tf.squeeze(tf.fromPixels(nirNIR,1).toFloat().div(255)); // The NIR Values
    /*-Keep-*/ let thermalTensor = tf.squeeze(tf.fromPixels(thermalTs,1).toFloat()).div(255).mul(thermalMapping[0]-thermalMapping[1]).add(thermalMapping[1]); // Maps Thermal Values to Kelvin Temperatures
    /*-Destroy-*/ let rgbTensor = tf.squeeze(tf.fromPixels(albedoImg).toFloat()); // A tensor of RGB Values

    nirReds = null;
    nirNIR = null;
    albedoImg = null;

    /*-Disp-*/ console.log("Images Succesfully Converted to Matricies.");
    // --- Basic Calculations ---
    /*-Keep-*/ let ndvi = nirTensor.sub(redsTensor).div(nirTensor.add(redsTensor)); // Normalized-Difference Vegetation Index
    /*-Destroy-*/ let savi = nirTensor.sub(redsTensor).mul(1.1).div(nirTensor.add(redsTensor).add(.1)); // Soil Adjusted Vegitation Index
    /*-Destroy-*/ let lai = savi.mul(-1).add(.69).div(.59).log().div(.91); // Leaf area index
                  //console.log(lai.dataSync()[2365+imgW*1036]);
    /*-Destroy-*/ let emissivity = lai.mul(.01).add(.95); // Surface Emissivity
    /*-Destroy-*/ let [rgbRTensor,rgbGTensor,rgbBTensor,rgbATensor] = tf.split(rgbTensor,3,2); // Seperate tensors with red-blue-green values
    /*-Destroy-*/ let albedo = tf.squeeze(rgbRTensor.add(rgbGTensor).add(rgbBTensor).div(765)); // albedo or surface reflectance

    tf.dispose([redsTensor,rgbTensor,rgbRTensor,rgbGTensor,rgbBTensor,rgbATensor,savi,lai]);

    /*-Disp-*/ console.log("Acquired: NDVI, SAVI, LAI, Emissivity, and Albedo.\nNow working on Net Radiation (Rn), and Soil Moisture Flux (G).");

    // --- Constant Definitions and Calculation ---
    /*-Scalar-*/ const solarInc = tedData.solarIncToTensor(); // Solar Incidence
    /*-Scalar-*/ const solarDist = tedData.solarDistToTensor(); // Distance from sun
    /*-Scalar-*/ const solarCond = tedData.solarCondToTensor(); // Solar Conductivity
    /*-Disp-*/ console.log(`--Solar Incidence: ${solarInc.toString()}\n--Solar Distance:\n ${solarDist.toString()}\n--Solar Conductivity: ${solarCond.toString()}`);

    /*-Scalar-*/ const incomingShortwave = solarDist.reciprocal().pow(tf.scalar(2)).mul(solarInc.cos()).mul(1367).mul(solarCond); // Incoming shortwave radiation
    /*-Scalar-*/ const incomingLongwave = tf.scalar(Math.pow(tedData.temperature,4)*5.6*Math.pow(10,-8)); // Incoming longwave radiation
    /*-Disp-*/ console.log(`--Incoming Shortwave: ${incomingShortwave.toString()}\n--Incoming Longwave:\n ${incomingLongwave.toString()}`);

    /*-Destroy-*/ const outgoingLongwave = thermalTensor.pow(tf.scalar(4)).mul(tf.scalar(5.6*Math.pow(10,-8))).mul(emissivity); // Outgoing longwave radiation
    /*-Keep-*/ const netRadiationRn = incomingShortwave.sub(albedo.mul(incomingShortwave)).add(outgoingLongwave).add(emissivity.mul(incomingLongwave)); // Rn or net radiation
    /*-Keep-*/ const soilMoistureFluxG = thermalTensor.div(ndvi.pow(tf.scalar(4)).mul(albedo.pow(tf.scalar(3))).mul(-.007252).add(albedo.pow(tf.scalar(3)).mul(.0074)).sub(ndvi.pow(tf.scalar(4)).mul(albedo.pow(tf.scalar(2))).mul(.003724)).add(albedo.pow(tf.scalar(2)).mul(.0038))).mul(netRadiationRn); // Soil Moisture Flux

    tf.dispose([emissivity,albedo,outgoingLongwave]);

    /*-Disp-*/ console.log("Acquired: Net Radiation (Rn), and Soil Moisture Flux (G).\nNow working on Ground Roughness (Rah), Sensible Heat Flux (H), and Latent Heat Flux (&#x3BB;).");

    /*-Scalar-*/ const groundRoughnessRah = tf.scalar(heightGround/heightAir).log().div(frictionVelocityU).mul(.41); // Ground Roughness
    /*-Disp-*/ console.log(`--Ground Roughness: ${groundRoughnessRah.toString()}`);

    /*-Destroy-*/ const sensibleHeatFluxH = thermalTensor.mul(-1).add(tedData.temperature).mul(airDensity).mul(1004).div(groundRoughnessRah); // Sensible Heat Flux
    /*-Destroy-*/ const latentHeatFluxLambda = netRadiationRn.sub(soilMoistureFluxG).sub(sensibleHeatFluxH); // Latent Heat Flux

    /*-Disp-*/ console.log("Acquired: Ground Roughness (Rah), Sensible Heat Flux (H), and Latent Heat Flux (&#x3BB;).\nNow working on Hendrick's Ratio (v1, &#94;), and Soil Saturation.");

    /*-Destroy-*/ const hendricksRatioChevron1 = latentHeatFluxLambda.div(latentHeatFluxLambda.add(sensibleHeatFluxH)); // Whatever chevron is

    tf.dispose([sensibleHeatFluxH,latentHeatFluxLambda]);

    /*-Keep-*/ const soilSaturation1 = tf.exp(hendricksRatioChevron1.sub(1).div(.42)); // Soil Saturation

    tf.dispose(hendricksRatioChevron1);

    // --- Create the p5 image ---
    //let RawNIR = ndvi.mul(255).toInt().dataSync();
    //let RawThermal = thermalTensor.mul(255).toInt().dataSync();
    //let RawNDVI = ndvi.mul(255).toInt().dataSync();
    //let RawRn = netRadiationRn.mul(255).toInt().dataSync();
    //let RawSoilFlux = soilMoistureFluxG.mul(255).toInt().dataSync();
    let RawSoil1 = soilSaturation1.mul(255).toInt().dataSync();

    //tf.dispose([nirTensor,thermalTensor,ndvi,soilSaturation1,netRadiationRn,soilMoistureFluxG]);

    //nirImage = makeImage(imgW,imgH,RawNIR);
    //ndviImage = makeImage(imgW,imgH,RawNDVI).save('ndvi.jpg');
    //rnImage = makeImage(imgW,imgH,RawRn).save('netRadiation.jpg');
    //soilFluxImage = makeImage(imgW,imgH,RawSoilFlux).save('soilFlux.jpg');
    soilImage = makeImage(imgW,imgH,RawSoil1);


    //RawNIR = null;
    //RawNDVI = null;
    //RawRn = null;
    //RawSoilFlux = null;
    //RawSoil1 = null;
    //nirImage = null;
    //ndviImage = null;
    //nirReds = null;
    //nirNIR = null;
    //thermalTs = null;
    //albedoImg = null;

    /*-Disp-*/ //console.log("Images Calculated and Saved Successfully!");
  });
}

// --- p5 'While true' ---
function draw() {
  frameRate(1);
  clear();
  if(frameCount%2 == 0) image(rgb,0,0,500,636);
  else image(soilImage,0,0,500,636);
}
