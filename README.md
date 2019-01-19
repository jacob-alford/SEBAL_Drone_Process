# SEBAL_Drone_Process
Processes drone images using the SEBAL algorithm to calculate soil saturation.

## Inputs
Takes two input images (and can be configred differently):
1. RGB Image (where the red, green, and blue channels correspond to the red, green, and blue bands respectively captured by the drone).
1. Composite Image (where the red, green, and blue channels correspond to the red, thermal, and near-infared bands respectively captured by the drone).

## General Algorithm
This program uses the latest ECMAScript standard, Tensorflow.js, and p5.js while importing, processing, exporting, and displaying images; and uses several memory-saving techniques for the proper execution of the SEBAL algorithm. 
* Uses latest tensorflow.js libraries to operate on GPU hardware built for image processing.
* Uses a check-point system which recognizes the images that have been imported, and processes the code relevant to those images.
* Frequently disposes uncecessary tensors and javascript objects.
### Note: due to p5.js limitations, the images being imported must be commented/uncommented where necessary; the code will handle the rest.

### Sample Inputs
#### RGB Image:
![RGB Image](RGB.jpg)
#### Composite Image:
![Composite Image](composite.jpg)

### Sample Outputs
Name | Image
---- | -----
Net Radiation (Rn) | ![Net Rad](RnImage.jpg)
Thermal Image (extracted) | ![Thermal](thermalImg.jpg)
Soil Flux (G) | ![Soil Flux](SoilFlux.jpg)
Sensible Heat Flux (H) | ![Heat Flux](sensHeatFlux.jpg)
Soil Saturation (S) | ![Soil Sat](soilSat.jpg)
