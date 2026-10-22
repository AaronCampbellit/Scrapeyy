import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(()=>({tabs:{get:vi.fn(),query:vi.fn()},cookies:{getAllCookieStores:vi.fn(),getAll:vi.fn()},scripting:{executeScript:vi.fn()}}));
vi.mock('../../src/platform/browser-api',()=>({extensionBrowser:api}));
import { captureSession } from '../../src/session/capture';
const origin='https://shop.example.test';
const raw={name:'fake',value:'synthetic',domain:'.example.test',path:'/orders',hostOnly:false,secure:true,httpOnly:true,sameSite:'unspecified',session:true,storeId:'container'};
beforeEach(()=>{
 api.tabs.get.mockResolvedValue({id:7,url:origin+'/orders'});
 api.tabs.query.mockResolvedValue([{id:7,url:origin+'/orders'},{id:8,url:origin+'/other'}]);
 api.cookies.getAllCookieStores.mockResolvedValue([{id:'container',tabIds:[7]},{id:'other',tabIds:[8]}]);
 api.cookies.getAll.mockResolvedValue([raw,{...raw,name:'partitioned',partitionKey:{topLevelSite:origin}},{...raw,name:'isolated',firstPartyDomain:'example.test'},{...raw,name:'unrelated',domain:'.other.test'}]);
 api.scripting.executeScript.mockResolvedValue([{result:{origin,localStorage:[],sessionStorage:[{name:'fake',value:'synthetic'}]}}]);
});
it('scopes all cookie calls and storage to the source store; excludes foreign and partitioned cookies',async()=>{
 const result=await captureSession([origin],7);
 expect(result.cookies).toEqual([raw]);
 expect(result.storage).toHaveLength(1);
 expect(result.warnings.join()).toContain('2 partitioned');
 for(const [query] of api.cookies.getAll.mock.calls){expect(query.storeId).toBe('container');expect(query.domain || query.url).toBeTruthy();}
 expect(api.cookies.getAll).toHaveBeenCalledWith(expect.objectContaining({url:origin+'/orders'}));
 expect(api.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({target:{tabId:7,frameIds:[0]}}));
});
it('fails before cookies when the source tab navigated away',async()=>{
 api.tabs.get.mockResolvedValue({id:7,url:'https://other.test'});
 await expect(captureSession([origin],7)).rejects.toThrow('changed');
 expect(api.cookies.getAll).not.toHaveBeenCalled();
});
it('omits storage when navigation races execution without exporting another origin',async()=>{
 api.scripting.executeScript.mockResolvedValue([{result:{origin:'https://other.test',localStorage:[{name:'bad',value:'bad'}],sessionStorage:[]}}]);
 const result=await captureSession([origin],7);
 expect(result.storage).toEqual([]);expect(result.warnings.join()).toContain('Storage unavailable');
});

it('normalizes Firefox null partition keys without treating actual partition objects as unpartitioned',async()=>{
 const {default:firefoxCookies}=await import('../fixtures/session-borrow/firefox-cookies.json');
 api.cookies.getAll.mockResolvedValue(firefoxCookies);
 const result=await captureSession([origin],7);
 expect(result.cookies).toHaveLength(1);
 expect(result.cookies[0]!.name).toBe('firefox-unpartitioned');
 expect(result.cookies[0]).not.toHaveProperty('partitionKey');
 expect(result.warnings.join()).toContain('2 partitioned');
 expect(firefoxCookies[0]!.partitionKey).toBeNull();
 expect(firefoxCookies[1]!.partitionKey).toEqual({topLevelSite:origin});
});
