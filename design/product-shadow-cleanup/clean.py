import cv2,numpy as np,json
from PIL import Image,ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'public';items=json.loads(Path(__file__).with_name('targets.json').read_text())
Path('/tmp/nsp-clean2').mkdir(exist_ok=True)
for it in items:
 im=Image.open(root/it['image'].lstrip('/')).convert('RGBA');white=Image.new('RGBA',im.size,'white');white.alpha_composite(im);rgb=np.array(white.convert('RGB'));h,w=rgb.shape[:2]
 hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV);sat=hsv[:,:,1];v=hsv[:,:,2];ch=rgb.max(axis=2).astype(int)-rgb.min(axis=2).astype(int)
 strong=((sat>35)&(ch>12))|((v<65)&(np.indices((h,w))[0]<h*.72))
 strong=strong.astype('uint8')*255
 strong=cv2.morphologyEx(strong,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
 contours,_=cv2.findContours(strong,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 keep=np.zeros((h,w),np.uint8)
 groups=[]
 for c in contours:
  if cv2.contourArea(c)<h*w*.0005:continue
  x,y,cw,chh=cv2.boundingRect(c)
  merge=[g for g in groups if x<=g[1]+3 and x+cw>=g[0]-3]
  points=[c]+[g[2] for g in merge]
  for g in merge:groups.remove(g)
  joined=np.concatenate(points)
  gx,gy,gw,gh=cv2.boundingRect(joined);groups.append([gx,gx+gw,joined])
 for g in groups: cv2.drawContours(keep,[cv2.convexHull(g[2])],-1,255,-1)
 edit=np.indices((h,w))[0]>h*.65
 # White packages need their original pale rim preserved through the base.
 white_ids={4,5,11,12,36,37,50,61,62,63,69,80,86,92,93,124,125,141,142,143,151,153,154,155,157,164}
 if it['index'] in white_ids:
  center=rgb[:,int(w*.46):int(w*.54)].mean(axis=(1,2))
  base=int(np.where(center<200)[0][-1])+1
  if it['index']==37:base=int(h*.948)
  if it['index']==153:base=int(h*.852)
  if it['index']==93:base=int(h*.952)
  if it['index']==12:base=int(h*.849)
  if it['index']==86:base=int(h*.847)
  row=max(0,base-int(h*.09));xs=np.where(rgb[row].min(axis=1)<245)[0]
  left,right=int(xs[0]),int(xs[-1])
  # Preserve the existing object; whitening is confined to its surrounding lower background.
  keep[:]=0
  keep[:row,:]=255
  depth=max(3,int((right-left)*(.20 if it['index']==93 else .12)))
  for xx in range(left,right+1):
   fraction=(xx-(left+right)/2)/max(1,(right-left)/2)
   end=int(base-depth+depth*np.sqrt(max(0,1-fraction*fraction)))
   keep[row:end+1,xx]=255
  edit=np.indices((h,w))[0]>=row
 rgb[(keep==0)&edit]=255
 Image.fromarray(rgb).save('/tmp/nsp-clean2/'+str(it['index'])+'.png')
