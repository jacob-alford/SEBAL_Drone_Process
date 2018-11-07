//---SEBAL-Specific-Constants
const sigma = 5.67 * Math.pow(10,-8); // Boltzman Constant
//---Astronomy-Specific-Constants
const perihelion = 2; //The day in January of the perihelion, used for distance calculation
const ast_a = 1.496 * Math.pow(10,11); //Earth's semi-major axis
const ast_e = .0167; //Earth's eccentricity
const airTemp = 294.25; // Air temperature at the time of capture
const heightGround = .1; //m
const heightAir = 1.8; //m
const windSpeed = 3.6; //m/s
const heightWindSensor = 2; //m
const plantHeightAvg = 2; //m
const airDensity = 1; //kg/m^2
const zenithAngle = .4337;
let frictionVelocityU = .41*windSpeed/Math.log(heightWindSensor/.12*plantHeightAvg);
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
let frictionVelocityU200;
let groundRoughnessRah;
let sensibleHeatFluxH;
let moninObukhovLengthL;
let psiHg;
let psiHs;
let psiM;

let tempNirNir;
let tempThermal;
let tempNirReds;

let ndvi;
let savi;
let lai;

// --- Class Definition and Supporting Functions
class GeoData{
  constructor(date){
    let doy = date.getDOY();
    console.log(doy);
    this.solarDeclination = -1 * Math.asin(.39779 * Math.cos(.98565 * (doy + 10) + 1.914 * Math.sin(.98565 * (doy - 2))));
    this.solarDistance = (ast_a * (1-Math.pow(ast_e,2)))/(1+(ast_e * Math.cos((365.25/360) * (doy-perihelion))))/(1.496*Math.pow(10,11));
    this.atmTrans = .75 + 2*Math.pow(10,-5)*1511;
    this.solarIncidence = zenithAngle;
    this.temperature = airTemp;
    this.atmosEmiss = .85 * Math.pow(-1 * Math.log(this.atmTrans),.09);
  }
  solarIncToTensor(){
    return tf.scalar(this.solarInclination);
  }
  solarDistToTensor(){
    return tf.scalar(this.solarDistance);
  }
  solarAtmTransToTensor(){
    return tf.scalar(this.atmTrans);
  }
  solarIncToTensor(){
    return tf.scalar(this.solarIncidence);
  }
  atmosEmissToTensor(){
    return tf.scalar(this.atmosEmiss);
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



  // --- Get all the necessary images and their respective matricies ---
  tempNirReds = [];
  tempThermal = [];
  tempNirNir = [];

  nearInfared.loadPixels();
  // --- Assign the respective channel values to the ImageData objects above ---
  nearInfared.pixels.forEach((c,i) => {
    if(i%4 == 0) tempNirReds[i/4] = c; // The red pixels go to the red temporary array
    else if(i%4 == 1) tempNirNir[(i-1)/4] = c; // The greens (or near infared band) go to nir temporary array
    else if(i%4 == 2) tempThermal[(i-2)/4] = c; // The blues (or thermal band) go to thermal array
  });

  let tempAlbedo = [];
  // --- Assign albedo Pixels ---
  rgb.loadPixels();
  rgb.pixels.forEach((c,i) => {
    tempAlbedo[i] = c;
  });

  // --- TensorFlow Garbage Collect ---
  tf.tidy(() => {
    console.log("Hello.");
    // --- Create the tensors ---

     let redsTensor = tf.tensor(tempNirReds,[imgW,imgH]); // The red values
     let nirTensor = tf.tensor(tempNirNir,[imgW,imgH]); // The NIR Values
     let rgbTensor = tf.tensor(tempAlbedo,[imgW,imgH,4]); // A tensor of RGB Values

    tempNirReds = null;
    tempNirNir = null;
    tempAlbedo = null;

     ndvi = nirTensor.sub(redsTensor).div(nirTensor.add(redsTensor)); // Normalized-Difference Vegetation Index
     savi = nirTensor.sub(redsTensor).mul(1.1).div(nirTensor.add(redsTensor).add(.1)); // Soil Adjusted Vegitation Index
     lai = savi.mul(-1).add(.69).div(.59).log().div(.91).mul(-1); // Leaf area index

     console.log("--Sample NDVI (from grass):");
     console.log(ndvi.dataSync()[2136+919*imgW]);
     console.log("--Sample SAVI (from grass):");
     console.log(savi.dataSync()[2136+919*imgW]);
     console.log("--Sample LAI (from grass):");
     console.log(lai.dataSync()[2165+919*imgW]);

      let tempLai = lai.dataSync();
      let tempEmiss = [];
      tempLai.forEach(c => {
        tempEmiss.push((c<3)?c*.01+.95:.98);
      });
     let emissivity = tf.tensor(tempEmiss,[imgW,imgH]); // Surface Emissivity
     console.log("--Sample Emissivity (from grass):");
     console.log(emissivity.dataSync()[2165+919*imgW]);
      tempEmiss = null;
      tempLai = null;

    let thermalTensor = mapTensor(tf.tensor(tempThermal,[imgW,imgH]),0,255,thermalMapping[0],thermalMapping[1]).pow(4).sub(emissivity.mul(-1).add(1).mul(Math.pow(tedData.temperature,4))).div(emissivity).pow(.25); // Maps Thermal Values to Kelvin Temperatures
    console.log("--Sample Thermal Measurements (from grass):");
    console.log(thermalTensor.dataSync()[2165+919*imgW]);

    tempThermal = null;

    const solarInc = tedData.solarIncToTensor(); // Solar Incidence
    console.log("--Solar Incidence:");
    solarInc.print();

    const solarDist = tedData.solarDistToTensor(); // Distance from sun
    console.log("--Solar Distance:");
    solarDist.print();

    const atmTransTens = tedData.solarAtmTransToTensor(); // Atmosphereic Transmisivity
    console.log("--Atmospheric Transmisivity:");
    atmTransTens.print();

    const incomingShortwave = solarDist.reciprocal().pow(2).mul(solarInc.cos()).mul(1367).mul(atmTransTens); // Incoming shortwave radiation
    console.log("--Incoming Shortwave Radiation:");
    incomingShortwave.print();

    const incomingLongwave = tf.scalar(Math.pow(tedData.temperature,4)*5.6*Math.pow(10,-8)).mul(tedData.atmosEmissToTensor()); // Incoming longwave radiation
    console.log("--Incoming Longwave Radiation:");
    incomingLongwave.print();

     let [rgbRTensor,rgbGTensor,rgbBTensor,rgbATensor] = tf.split(rgbTensor,4,2); // Seperate tensors with red-blue-green values
     let reds = tf.squeeze(rgbRTensor);
      let greens = tf.squeeze(rgbGTensor);
      let blues = tf.squeeze(rgbBTensor);
      let albedo = tf.squeeze(reds.add(greens).add(blues).div(incomingShortwave)); // albedo or surface reflectance
      console.log("--Albedo:");
      console.log(albedo.dataSync()[2165+919*imgW]);
    tf.dispose([redsTensor,rgbTensor,rgbRTensor,rgbGTensor,rgbBTensor,rgbATensor,reds,greens,blues]);

     const outgoingLongwave = thermalTensor.pow(tf.scalar(4)).mul(tf.scalar(5.67*Math.pow(10,-8))).mul(emissivity); // Outgoing longwave radiation
     console.log("--Outgoing Longwave Radiation:");
     console.log(outgoingLongwave.dataSync()[2165+919*imgW]);

     const netRadiationRn = incomingShortwave.sub(albedo.mul(incomingShortwave)).sub(outgoingLongwave).add(emissivity.mul(incomingLongwave)); // Rn or net radiation
     console.log("--Net Radiation (Rn):");
     console.log(netRadiationRn.dataSync()[2165+919*imgW]);

     const soilMoistureFluxG = thermalTensor.sub(273.15).mul(albedo.mul(.0074).add(.0038)).mul(ndvi.pow(4).mul(-.98).add(1)).mul(netRadiationRn); // Soil Moisture Flux
     console.log("--Soil Moisture Flux (G):");
     console.log(soilMoistureFluxG.dataSync()[2165+919*imgW]);

    tf.dispose([emissivity,albedo,outgoingLongwave]);

    psiHg = tf.variable(tf.ones([imgW,imgH]));
    psiHs = tf.variable(tf.ones([imgW,imgH]));
    psiM = tf.variable(tf.ones([imgW,imgH]));

    frictionVelocityU200 = frictionVelocityU*(Math.log(200/heightGround)/.41);

    frictionVelocityU = (.41*frictionVelocityU200)/(Math.log(200/heightGround));

    groundRoughnessRah = tf.tensor((Math.log(heightGround/heightAir) - psiH.dataSync()[1] + psiH.dataSync()[0])/(frictionVelocityU * .41),[imgW,imgH]); // Ground Roughness

    for(let c=0;c<9;c++){
       sensibleHeatFluxH = thermalTensor.mul(-1).add(tedData.temperature).mul(airDensity).mul(1004).div(groundRoughnessRah); // Sensible Heat Flux
       moninObukhovLengthL = thermalTensor.mul(Math.pow(frictionVelocityU,3)).mul(1004).div(sensibleHeatFluxH.mul(.41*9.81));
       if(moninObukhovLengthL.min() > 0){
         psiM.assign(moninObukhovLengthL.reciprocal().mul(-10));
         psiHs.assign(moninObukhovLengthL.reciprocal().mul(-10));
         psiHg.assign(moninObukhovLengthL.reciprocal().mul(-.5));
       }else if(moninObukhovLengthL.max() < 0){
         psiM.assign(moninObukhovLengthL.reciprocal().mul(-3200).add(1).pow(.25).add(1).div(2).log().mul(2).add(moninObukhovLengthL.reciprocal().mul(-3200).add(1).pow(.5).add(1).div(2).log()).add(moninObukhovLengthL.reciprocal().mul(-3200).add(1).pow(.25).atan().mul(-2)).add(.5 * Math.PI));
         psiHs.assign(moninObukhovLengthL.reciprocal().mul(-32).add(1).pow(.5).add(1).div(2).log().mul(2));
         psiHg.assign(moninObukhovLengthL.reciprocal().mul(-1.6).add(1).pow(.5).add(1).div(2).log().mul(2));
       }else if(moninObukhovLengthL.sum() == 0){
         psiM.assign(tf.zeros([imgW,imgH]));
         psiHs.assign(tf.zeros([imgW,imgH]));
         psiHg.assign(tf.zeros([imgW,imgH]));
       }else{
        let tempLValues = moninObukhovLengthL.dataSync();
        let output = [];
        tempLValues.forEach(v => {
          if(v>0){
            
          }else if(v<0){

          }else{

          }
        });
       }
    }
     //const latentHeatFluxLambda = netRadiationRn.sub(soilMoistureFluxG).sub(sensibleHeatFluxH); // Latent Heat Flux

     //console.log("Acquired: Ground Roughness (Rah), Sensible Heat Flux (H), and Latent Heat Flux (&#x3BB;).\nNow working on Hendrick's Ratio (v1, &#94;), and Soil Saturation.");

     //const hendricksRatioChevron1 = latentHeatFluxLambda.div(latentHeatFluxLambda.add(sensibleHeatFluxH)); // Whatever chevron is

    //tf.dispose([sensibleHeatFluxH,latentHeatFluxLambda]);

     //const soilSaturation1 = tf.exp(hendricksRatioChevron1.sub(1).div(.42)); // Soil Saturation

    //tf.dispose(hendricksRatioChevron1);

    // --- Create the p5 image ---
    //let RawNIR = ndvi.mul(255).toInt().dataSync();
    //let RawThermal = thermalTensor.mul(255).toInt().dataSync();
    //let RawLAI = lai.mul(255).toInt().dataSync();
    //let RawEmiss = emissivity.mul(255).toInt().dataSync();
    let RawRn = mapTensor(netRadiationRn,500,700,0,255).toInt().dataSync();
    let RawSoilFlux = mapTensor(soilMoistureFluxG,50,175,0,255).toInt().dataSync();
    //let RawSoil1 = soilSaturation1.mul(255).toInt().dataSync();

    //tf.dispose([nirTensor,thermalTensor,ndvi,soilSaturation1,netRadiationRn,soilMoistureFluxG]);

    //nirImage = makeImage(imgW,imgH,RawNIR);
    //laiImage = makeImage(imgW,imgH,RawLAI);
    //emissImage = makeImage(imgW,imgH,RawEmiss);
    rnImage = makeImage(imgW,imgH,RawRn);
    rnImage.save("RnImage.jpg");

    soilFluxImage = makeImage(imgW,imgH,RawSoilFlux);
    soilFluxImage.save("SoilFlux.jpg");
    //soilImage = makeImage(imgW,imgH,RawSoil1);


    //RawNIR = null;
    //RawNDVI = null;
    RawRn = null;
    RawSoilFlux = null;
    //RawSoil1 = null;
    //nirImage = null;
    //ndviImage = null;
    //nirReds = null;
    //nirNIR = null;
    //thermalTs = null;
    //albedoImg = null;

     //console.log("Images Calculated and Saved Successfully!");
  });
}

// --- p5 'While true' ---
function draw() {
  frameRate(1);
  clear();
  if(frameCount%2 == 0) image(soilFluxImage,0,0,500,636);
  else image(rnImage,0,0,500,636);
}
