import Foundation
import AppKit
import CoreImage
import ImageIO
import UniformTypeIdentifiers

// Original screenshot silhouettes. Paths use source pixel coordinates, without changing bottle geometry.
let args=CommandLine.arguments
func arg(_ name:String)->String{guard let i=args.firstIndex(of:name),i+1<args.count else{fatalError("Missing \(name)")};return args[i+1]}
let backgroundURL=URL(fileURLWithPath:arg("--background"))
let chlorophyllURL=URL(fileURLWithPath:arg("--chlorophyll"))
let omegaURL=URL(fileURLWithPath:arg("--omega"))
let outputURL=URL(fileURLWithPath:arg("--out"))
let cutoutDirectory=URL(fileURLWithPath:arg("--cutouts"))
let W:CGFloat=3840,H:CGFloat=1536
let colorSpace=CGColorSpace(name:CGColorSpace.sRGB)!
let renderer=CIContext(options:[.workingColorSpace:colorSpace,.outputColorSpace:colorSpace,.useSoftwareRenderer:false])
func load(_ url:URL)->CIImage{guard let image=CIImage(contentsOf:url) else{fatalError("Cannot read \(url.lastPathComponent)")};return image}
func write(_ image:CIImage,_ url:URL,_ rect:CGRect){
 guard let cg=renderer.createCGImage(image,from:rect,format:.RGBA8,colorSpace:colorSpace),let destination=CGImageDestinationCreateWithURL(url as CFURL,UTType.png.identifier as CFString,1,nil) else{fatalError("Cannot write \(url.lastPathComponent)")}
 CGImageDestinationAddImage(destination,cg,nil)
 guard CGImageDestinationFinalize(destination) else{fatalError("Image export failed")}
}
func maskPath(_ kind:String,_ height:CGFloat)->CGPath{
 let p=CGMutablePath()
 func point(_ x:CGFloat,_ y:CGFloat)->CGPoint{CGPoint(x:x,y:height-y)}
 func move(_ x:CGFloat,_ y:CGFloat){p.move(to:point(x,y))}
 func line(_ x:CGFloat,_ y:CGFloat){p.addLine(to:point(x,y))}
 func curve(_ x1:CGFloat,_ y1:CGFloat,_ x2:CGFloat,_ y2:CGFloat,_ x:CGFloat,_ y:CGFloat){p.addCurve(to:point(x,y),control1:point(x1,y1),control2:point(x2,y2))}
 if kind=="chlorophyll"{
  move(147,15.8);curve(169,15.8,183,17.4,187.5,23)
  line(187.5,60);curve(188,64,186,65.5,185,68)
  curve(197,72,200.5,76,200.5,84);line(200.5,103)
  curve(200.5,108,197,110,195,112)
  curve(193,129,194,147,196,162)
  curve(198,179,200,193,204,202)
  curve(214,217,231,234,240,246)
  curve(243,251,244,257,242.7,264)
  line(242.7,552)
  curve(242.7,567,237,576,217,581)
  curve(191,587,107,587,78,580.5)
  curve(57,575.5,49.2,567,49.2,552)
  line(49.2,266)
  curve(47.8,258,49.5,251,57,242.5)
  curve(72,226,83,213,88,200)
  curve(95,180,97,150,97,131)
  line(97,113)
  curve(93,111,91.5,107,91.5,103)
  line(91.5,84)
  curve(91.5,78,96,73,107,70)
  line(108,67)
  curve(105,65,104.8,62,104.8,58)
  line(104.8,27)
  curve(104.8,20,117,16,147,15.8)
 }else{
  move(183,21.5)
  curve(222,21.5,263,25,276,34.5)
  curve(281,38.5,281.3,43,281.3,49)
  line(281.3,100)
  curve(280,105,273,108,272.5,111)
  line(272.5,119)
  curve(290,123,305,140,305.5,158)
  line(305.5,475)
  curve(305.5,487,299,494,282,499)
  curve(245,510,122,510,85,499)
  curve(68,494,60.5,487,60.5,475)
  line(60.5,161)
  curve(60.5,143,70,132,93.5,122)
  line(93.5,111)
  curve(86,107,84.5,104,84.5,100)
  line(84.5,49)
  curve(84.5,41,88,36,97,32)
  curve(122,24,153,21.5,183,21.5)
 }
 p.closeSubpath();return p
}
func cutout(_ url:URL,_ kind:String,_ expected:CGSize)->CIImage{
 let image=load(url);let width=Int(image.extent.width),height=Int(image.extent.height)
 guard width==Int(expected.width),height==Int(expected.height) else{fatalError("Reference dimensions changed for \(kind)")}
 let mask=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:colorSpace,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
 mask.setFillColor(CGColor(red:0,green:0,blue:0,alpha:1));mask.fill(CGRect(x:0,y:0,width:width,height:height))
 let path=maskPath(kind,CGFloat(height));mask.setShouldAntialias(true)
 mask.setFillColor(CGColor(red:1,green:1,blue:1,alpha:1));mask.addPath(path);mask.fillPath()
 var alpha=CIImage(cgImage:mask.makeImage()!)
 if kind=="omega"{
  let inner=alpha.applyingFilter("CIMorphologyMinimum",parameters:[kCIInputRadiusKey:4.0])
  let matte=CIColorKernel(source:"""
  kernel vec4 removeWhiteFringe(__sample source, __sample mask, __sample inner) {
   float low=min(source.r,min(source.g,source.b));
   float high=max(source.r,max(source.g,source.b));
   float white=smoothstep(0.78,0.96,low);
   float neutral=1.0-smoothstep(0.03,0.09,high-low);
   float a=mask.r*(1.0-(1.0-inner.r)*white*neutral);
   return vec4(a,a,a,1.0);
  }
  """)!
  alpha=matte.apply(extent:image.extent,arguments:[image,alpha,inner])!
 }
 let transparent=CIImage(color:CIColor(red:0,green:0,blue:0,alpha:0)).cropped(to:image.extent)
 let result=image.applyingFilter("CIBlendWithMask",parameters:[kCIInputBackgroundImageKey:transparent,kCIInputMaskImageKey:alpha])
 let box=path.boundingBoxOfPath.integral
 let cropped=result.cropped(to:box).transformed(by:CGAffineTransform(translationX:-box.minX,y:-box.minY))
 write(cropped,cutoutDirectory.appendingPathComponent(kind+"-original-cutout.png"),cropped.extent)
 return cropped
}
func scaled(_ image:CIImage,_ scale:CGFloat)->CIImage{
 image.applyingFilter("CILanczosScaleTransform",parameters:[kCIInputScaleKey:scale,kCIInputAspectRatioKey:1.0])
}
let white=cutout(chlorophyllURL,"chlorophyll",CGSize(width:300,height:604))
let amber=cutout(omegaURL,"omega",CGSize(width:386,height:516))
let originalBackground=load(backgroundURL)
let backgroundScale=max(W/originalBackground.extent.width,H/originalBackground.extent.height)
let largeBackground=scaled(originalBackground,backgroundScale)
let cropY=(largeBackground.extent.height-H)*0.35
let rect=CGRect(x:0,y:0,width:W,height:H)
let background=largeBackground.cropped(to:CGRect(x:0,y:cropY,width:W,height:H)).transformed(by:CGAffineTransform(translationX:0,y:-cropY))
let whiteHeight=H*0.77,amberHeight=whiteHeight*11.75/19.7
let baseline=H*(1-0.85)
let whiteScale=whiteHeight/white.extent.height,amberScale=amberHeight/amber.extent.height
let whiteSized=scaled(white,whiteScale),amberSized=scaled(amber,amberScale)
let whiteWidth=white.extent.width*whiteScale,amberWidth=amber.extent.width*amberScale
let whiteCenter=W*0.72,amberCenter=W*0.61
func place(_ image:CIImage,_ center:CGFloat,_ width:CGFloat)->CIImage{
 image.transformed(by:CGAffineTransform(translationX:center-width/2-image.extent.minX,y:baseline-image.extent.minY))
}
let shadowContext=CGContext(data:nil,width:Int(W),height:Int(H),bitsPerComponent:8,bytesPerRow:Int(W)*4,space:colorSpace,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
for (center,width) in [(whiteCenter,whiteWidth),(amberCenter,amberWidth)]{
 shadowContext.setFillColor(CGColor(red:0.07,green:0.12,blue:0.10,alpha:0.24))
 shadowContext.fillEllipse(in:CGRect(x:center-width*0.52,y:baseline-12,width:width*1.04,height:24))
}
let shadows=CIImage(cgImage:shadowContext.makeImage()!).applyingFilter("CIGaussianBlur",parameters:[kCIInputRadiusKey:8.0]).cropped(to:rect)
let withShadows=shadows.composited(over:background)
let result=place(whiteSized,whiteCenter,whiteWidth).composited(over:place(amberSized,amberCenter,amberWidth).composited(over:withShadows)).cropped(to:rect)
write(result,outputURL,rect)
let report:[String:Any]=[
 "outputPixels":[Int(W),Int(H)],"method":"Original screenshot cutouts over generated background; uniform scaling only",
 "sourceDetails":"4K export dimensions; background and screenshot details are upscaled, not native 4K generation",
 "backgroundNativePixels":[Int(originalBackground.extent.width),Int(originalBackground.extent.height)],
 "chlorophyll":["heightPx":whiteHeight,"visibleWidthPx":whiteWidth,"realHeightCm":19.7,"originalCropPixels":[Int(white.extent.width),Int(white.extent.height)]],
 "omega":["heightPx":amberHeight,"visibleWidthPx":amberWidth,"realHeightCm":11.75,"originalCropPixels":[Int(amber.extent.width),Int(amber.extent.height)]],
 "omegaHeightToChlorophyll":amberHeight/whiteHeight,"topGapPx":H-baseline-whiteHeight,
 "packagingColorsAndLabels":"Preserved from original screenshots; no generative redraw, no anisotropic scaling"
]
let json=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys])
try json.write(to:outputURL.deletingPathExtension().appendingPathExtension("json"))
print(String(data:json,encoding:.utf8)!)
