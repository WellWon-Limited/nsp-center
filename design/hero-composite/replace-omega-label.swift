import Foundation
import AppKit
import ImageIO
import UniformTypeIdentifiers

let root="/Users/marina/nsp_center/nsp-center/"
let input=root+"public/images/hero-dimensions-2026-11-13/01-mint-woodland-headroom-v3.png"
let reference="/Users/marina/Library/Application Support/WellWon Factory/chat-hooks/0361262fff01cad3/attachments/paste-61077db1-ee8f-40e1-b2ca-263dd6b1cdad.png"
let output=root+"public/images/hero-dimensions-2026-11-13/01-mint-woodland-omega-label-v4.png"
func image(_ path:String)->CGImage{NSImage(contentsOfFile:path)!.cgImage(forProposedRect:nil,context:nil,hints:nil)!}
let base=image(input),ref=image(reference),w=base.width,h=base.height
let space=base.colorSpace ?? CGColorSpaceCreateDeviceRGB()
let flags=CGImageAlphaInfo.premultipliedLast.rawValue
func pixels(_ image:CGImage,_ width:Int,_ height:Int)->[UInt8]{
 var bytes=[UInt8](repeating:0,count:width*height*4)
 bytes.withUnsafeMutableBytes{b in let c=CGContext(data:b.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:flags)!;c.interpolationQuality = .high;c.draw(image,in:CGRect(x:0,y:0,width:width,height:height))}
 return bytes
}
// Replace only printed paper. Original cap, amber glass, silhouette, shading outside the label, plants and background stay byte-identical.
let x=1132,y=559,pw=211,ph=189
let label=ref.cropping(to:CGRect(x:42,y:210,width:246,height:224))!
let paper=pixels(label,pw,ph),original=pixels(base,w,h)
var result=original
for row in 0..<ph{for col in 0..<pw{
 let edge=min(min(Double(col)+0.5,Double(pw-col)-0.5),min(Double(row)+0.5,Double(ph-row)-0.5))
 let alpha=min(1.0,edge/2.5)
 let dst=((y+row)*w+x+col)*4,src=(row*pw+col)*4
 for channel in 0..<3{result[dst+channel]=UInt8((Double(paper[src+channel])*alpha+Double(original[dst+channel])*(1-alpha)).rounded())}
}}
let provider=CGDataProvider(data:Data(result) as CFData)!
let cg=CGImage(width:w,height:h,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:w*4,space:space,bitmapInfo:CGBitmapInfo(rawValue:flags),provider:provider,decode:nil,shouldInterpolate:true,intent:.defaultIntent)!
let destination=CGImageDestinationCreateWithURL(URL(fileURLWithPath:output) as CFURL,UTType.png.identifier as CFString,1,nil)!
CGImageDestinationAddImage(destination,cg,nil);guard CGImageDestinationFinalize(destination) else{fatalError("Export failed")}
let decoded=pixels(image(output),w,h)
var changedOutside=0,changedInside=0
for row in 0..<h{for col in 0..<w{let i=(row*w+col)*4;let differs=(0..<4).contains{decoded[i+$0] != original[i+$0]};if differs{if col>=x && col<x+pw && row>=y && row<y+ph{changedInside+=1}else{changedOutside+=1}}}}
guard changedOutside==0 else{fatalError("Unexpected changes outside the printed label: \(changedOutside)")}
let report:[String:Any]=["source":"01-mint-woodland-headroom-v3.png","output":"01-mint-woodland-omega-label-v4.png","dimensions":[w,h],"edit":"Only Omega printed label replaced from owner screenshot","regionTopLeftPixels":[x,y,pw,ph],"changedPixelsInside":changedInside,"changedPixelsOutside":changedOutside,"wholePhotoResized":false,"generated":false]
let data=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]);try data.write(to:URL(fileURLWithPath:output).deletingPathExtension().appendingPathExtension("json"));print(String(data:data,encoding:.utf8)!)
