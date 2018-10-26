//---SEBAL-Specific-Constants
const sigma = 5.67 * Math.pow(10,-8); // Boltzman Constant
//---Astronomy-Specific-Constants
const perihelion = 2; //The day in January of the perihelion, used for distance calculation
const ast_a = 1.496 * Math.pow(10,8); //Earth's semi-major axis
const ast_e = .0167; //Earth's eccentricity
const airTemp = 294.25; // Air temperature at the time of capture
const heightGround = .05; //m
const heightAir = 1.8; //m
const windSpeed = 3.6; //m/s
const heightWindSensor = 1.8; //m
const plantHeightAvg = 2; //m
const airDensity = 1; //kg/m^2
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
let saviImage;
let laiImage;
let soilImage;
// --- Class Definition and Supporting Functions
class GeoData{
  constructor(date){
    let doy = date.getDOY();
    this.solarDeclination = -1 * Math.asin(.39779 * Math.cos(.98565 * (doy + 10) + 1.914 * Math.sin(.98565 * (doy - 2))));
    this.solarDistance = (ast_a * (1-Math.pow(ast_e,2)))/(1+(ast_e * Math.cos((365.25/360) * (doy-perihelion))))/(1.496*Math.pow(10,11));
    this.solarConductivity = .75 + 2*Math.pow(10,-5)*1511;
    this.temperature = airTemp;
  }
  solarDecToTensor(){
    return tf.scalar(this.solarDeclination);
  }
  solarDistToTensor(){
    return tf.scalar(this.solarDistance);
  }
  solarCondToTensor(){
    return tf.scalar(this.solarConductivity);
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
    thermalTs.data[c] = nearInfared.pixels[c+1];
    nirNIR.data[c] = nearInfared.pixels[c+2];
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
    createDiv("<h2>Starting Process.</h2>");
    // --- Create the tensors ---
    /*-Destroy-*/ let redsTensor = tf.squeeze(tf.fromPixels(nirReds,1).toFloat()); // The red values
    /*-Keep-*/ let nirTensor = tf.squeeze(tf.fromPixels(nirNIR,1).toFloat()); // The NIR Values
    /*-Keep-*/ let thermalTensor = tf.squeeze(tf.fromPixels(thermalTs,1).toFloat()).div(255).mul(thermalMapping[0]-thermalMapping[1]).add(thermalMapping[1]); // Maps Thermal Values to Kelvin Temperatures
    /*-Destroy-*/ let rgbTensor = tf.squeeze(tf.fromPixels(albedoImg).toFloat()); // A tensor of RGB Values

    nirReds = null;
    nirNIR = null;
    albedoImg = null;

    /*-Disp-*/ createDiv("<h2>Images Succesfully Converted to Matricies.</h2>");
    // --- Basic Calculations ---
    /*-Keep-*/ let ndvi = nirTensor.sub(redsTensor).div(nirTensor.add(redsTensor)); // Normalized-Difference Vegetation Index
    /*-Keep-*/ let savi = nirTensor.sub(redsTensor).mul(1.1).div(nirTensor.add(redsTensor).add(.1)); // Not Sure
    /*-Keep-*/ let lai = savi.mul(-1).add(.69).div(.59).log().div(.91); // Leaf area index
    /*-Destroy-*/ let emissivity = lai.mul(.01).add(.95); // Surface Emissivity
    /*-Destroy-*/ let [rgbRTensor,rgbGTensor,rgbBTensor,rgbATensor] = tf.split(rgbTensor,3,2); // Seperate tensors with red-blue-green values
    /*-Destroy-*/ let albedo = tf.squeeze(rgbRTensor.add(rgbGTensor).add(rgbBTensor).div(765)); // albedo or surface reflectance

    tf.dispose([redsTensor,nirTensor,rgbTensor,rgbRTensor,rgbGTensor,rgbBTensor,rgbATensor]);

    /*-Disp-*/ createDiv("<h2>Acquired: NDVI, SAVI, LAI, Emissivity, and Albedo.<br>Now working on Net Radiation (Rn), and Soil Moisture Flux (G).</h2>");

    // --- Constant Definitions and Calculation ---
    /*-Scalar-*/ const solarDec = tedData.solarDecToTensor(); // Solar Declination
    /*-Scalar-*/ const solarDist = tedData.solarDistToTensor(); // Distance from sun
    /*-Scalar-*/ const solarCond = tedData.solarCondToTensor(); // Solar Conductivity
    /*-Disp-*/ createDiv(`<h2>--Solar Declination: ${solarDec.print()}<br>--Solar Distance:<br> ${solarDist.print()}<br>--Solar Conductivity: ${solarCond.print()}</h2>`);

    /*-Scalar-*/ const incomingShortwave = solarDist.reciprocal().pow(tf.scalar(2)).mul(solarDec.cos()).mul(1367).mul(solarCond); // Incoming shortwave radiation
    /*-Scalar-*/ const incomingLongwave = tf.scalar(Math.pow(tedData.temperature,4)*5.6*Math.pow(10,-8)); // Incoming longwave radiation
    /*-Disp-*/ createDiv(`<h2>--Incoming Shortwave: ${incomingShortwave.print()}<br>--Incoming Longwave:<br> ${incomingLongwave.print()}</h2>`);

    /*-Destroy-*/ const outgoingLongwave = thermalTensor.pow(tf.scalar(4)).mul(tf.scalar(5.6*Math.pow(10,-8))).mul(emissivity); // Outgoing longwave radiation
    /*-Keep-*/ const netRadiationRn = incomingShortwave.sub(albedo.mul(incomingShortwave)).add(outgoingLongwave).add(emissivity.mul(incomingLongwave)); // Rn or net radiation
    /*-Keep-*/ const soilMoistureFluxG = thermalTensor.div(ndvi.pow(tf.scalar(4)).mul(albedo.pow(tf.scalar(3))).mul(-.00686).add(albedo.mul(.007)).sub(ndvi.pow(tf.scalar(4)).mul(albedo).mul(003724)).add(albedo.mul(.0038))).mul(netRadiationRn); // Soil Moisture Flux

    tf.dispse([emissivity,albedo,outgoingLongwave]);

    /*-Disp-*/ createDiv("<h2>Acquired: Net Radiation (Rn), and Soil Moisture Flux (G).<br>Now working on Ground Roughness (Rah), Sensible Heat Flux (H), and Latent Heat Flux (&#x3BB;).</h2>");

    /*-Scalar-*/ const groundRoughnessRah = tf.scalar(heightGround/heightAir).log().div(frictionVelocityU).mul(.41); // Ground Roughness
    /*-Disp-*/ createDiv(`<h2>--Ground Roughness: ${groundRoughnessRah.print()}</h2>`);

    /*-Destroy-*/ const sensibleHeatFluxH = thermalTensor.mul(-1).add(tedData.temperature).mul(airDensity).mul(1004).div(groundRoughnessRah); // Sensible Heat Flux
    /*-Destroy-*/ const latentHeatFluxLambda = netRadiationRn.sub(soilMoistureFluxG).sub(sensibleHeatFluxH); // Latent Heat Flux

    /*-Disp-*/ createDiv("<h2>Acquired: Ground Roughness (Rah), Sensible Heat Flux (H), and Latent Heat Flux (&#x3BB;).<br>Now working on Hendrick's Ratio (v1, &#94;), and Soil Saturation.</h2>");

    /*-Destroy-*/ const hendricksRatioChevron1 = latentHeatFluxLambda.div(latentHeatFluxLambda.add(sensibleHeatFluxH)); // Whatever chevron is

    tf.dispose([sensibleHeatFluxH,latentHeatFluxLambda]);

    /*-Keep-*/ const soilSaturation1 = tf.exp(hendricksRatioChevron1.sub(1).div(.42)); // Soil Saturation

    tf.dispose(hendricksRatioChevron1);

    // --- Create the p5 image ---
    let RawNIR = nirTensor.dataSync();
    let RawThermal = thermalTensor.mul(255).toInt().dataSync();
    let RawNDVI = ndvi.mul(255).toInt().dataSync();
    let RawSAVI = savi.mul(255).toInt().dataSync();
    let RawLAI = lai.mul(255).toInt().dataSync();
    let RawSoil1 = soilSaturation1.mul(255).toInt().dataSync();

    tf.dispose([nirTensor,thermalTensor,ndvi,savi,lai,soilSaturation1]);

    nirImage = makeImage(imgW,imgH,RawNIR).save('nir.jpg');
    ndviImage = makeImage(imgW,imgH,RawNDVI).save('ndvi.jpg');
    saviImage = makeImage(imgW,imgH,RawSAVI).save('savi.jpg');
    laiImage = makeImage(imgW,imgH,RawLAI).save('lai.jpg');
    soilImage = makeImage(imgW,imgH,RawSoil1).save('soilSat.jpg');

    RawNIR = null;
    RawNDVI = null;
    RawSAVI = null;
    RawLAI = null;
    RawSoil1 = null;
    nirImage = null;
    ndviImage = null;
    saviImage = null;
    laiImage = null;
    nirReds = null;
    nirNIR = null;
    thermalTs = null;
    albedoImg = null;

    /*-Disp-*/ createDiv("<h2>Images Calculated and Saved Successfully!</h2>");
  });
}

// --- p5 'While true' ---
function draw() {
  frameRate(1);
  clear();
  if(frameCount%2 == 0) image(soilImage,0,0,500,636);
  else image(rgb,0,0,500,636);
}
