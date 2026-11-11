import AppKit
import Foundation
// Measures visible image bounds for CSS layout; source image files stay intact.
let directory=CommandLine.arguments.count>1 ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath
let root=directory.hasSuffix("/") ? directory : directory+"/"
let data=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:root+"src/generated/content.json"))) as! [String:Any]
let products=data["products"] as! [[String:Any]]
let preferred=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:root+"src/product-images.json"))) as! [String:[String:Any]]
let legacy=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:root+"src/product-image-overrides.json"))) as! [String:String]
var results=[String:[String:Any]]()
for p in products {
 let id=p["id"] as! String
 if preferred[id]==nil {continue}
 let original=p["image"] as! String,src=(preferred[id]?["image"] as? String) ?? legacy[original] ?? original
 guard let image=NSImage(contentsOfFile:root+"public"+src) else {continue}
 let scale=min(384/image.size.width,384/image.size.height),w=max(1,Int(image.size.width*scale)),h=max(1,Int(image.size.height*scale))
 guard let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:w,pixelsHigh:h,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:w*4,bitsPerPixel:32),let context=NSGraphicsContext(bitmapImageRep:bitmap),let pixels=bitmap.bitmapData else{continue}
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=context;NSColor.white.setFill();NSRect(x:0,y:0,width:w,height:h).fill();image.draw(in:NSRect(x:0,y:0,width:w,height:h));context.flushGraphics();NSGraphicsContext.restoreGraphicsState()
 var left=w,right=0,top=h,bottom=0
 for y in 0..<h {for x in 0..<w {let i=(y*w+x)*4;let r=Int(pixels[i]),g=Int(pixels[i+1]),b=Int(pixels[i+2]);if min(r,g,b)<242 && 765-r-g-b>35{left=min(left,x);right=max(right,x);top=min(top,y);bottom=max(bottom,y)}}}
 if left>=right || top>=bottom{continue}
 let bw=Double(right-left+1),bh=Double(bottom-top+1),ratio=bw/bh
 // Tall single containers share a visible height; wide jars stay naturally fitted.
 
 results[id] = ["image":src,"ratio":ratio,"left":Double(left)/Double(w),"top":Double(top)/Double(h),"width":bw/Double(w),"height":bh/Double(h)]
}
let out=try JSONSerialization.data(withJSONObject:results,options:[.prettyPrinted,.sortedKeys]);try out.write(to:URL(fileURLWithPath:root+"src/product-image-layout.json"));print("Measured product images: \(results.count)")
