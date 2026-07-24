import {expect,Page,Response} from '@playwright/test';

export type NetworkGuard={
  allowed(response:Response):void;
  allowNext(
    status:number,
    method:string,
    pathFragment:string
  ):void;
  assertClean():void;
};

export function guardApi(page:Page):NetworkGuard{
  const failures:string[]=[];
  const allowedResponses=new WeakSet<Response>();
  const allowedNext:Array<{
    status:number;
    method:string;
    pathFragment:string;
  }>=[];
  const allowedConsoleHttpStatuses:number[]=[];

  page.on('response',response=>{
    if(!response.url().includes('/api/v1/'))return;
    if(allowedResponses.has(response))return;
    const status=response.status();
    const expectedIndex=allowedNext.findIndex(expected=>
      expected.status===status&&
      expected.method===response.request().method()&&
      response.url().includes(expected.pathFragment)
    );
    if(expectedIndex>=0){
      allowedNext.splice(expectedIndex,1);
      return;
    }
    if(status===401||status===403||status>=500){
      failures.push(`${status} ${response.request().method()} ${response.url()}`);
    }
  });

  page.on('pageerror',error=>failures.push(`pageerror ${error.message}`));
  page.on('console',message=>{
    if(message.type()!=='error')return;

    const text=message.text();
    const httpStatus=text.match(
      /Failed to load resource: the server responded with a status of (\d+)/
    );
    if(httpStatus){
      const status=Number(httpStatus[1]);
      const expectedIndex=allowedConsoleHttpStatuses.indexOf(status);
      if(expectedIndex>=0){
        allowedConsoleHttpStatuses.splice(expectedIndex,1);
        return;
      }
    }

    failures.push(`console ${text}`);
  });

  return {
    allowed(response){
      allowedResponses.add(response);
    },
    allowNext(status,method,pathFragment){
      allowedNext.push({status,method,pathFragment});
      if(status>=400)allowedConsoleHttpStatuses.push(status);
    },
    assertClean(){
      expect(failures,failures.join('\n')).toEqual([]);
    }
  };
}

export async function waitForApi(
  page:Page,
  method:string,
  pathFragment:string,
  action:()=>Promise<void>
){
  const responsePromise=page.waitForResponse(response=>
    response.request().method()===method&&
    response.url().includes(pathFragment)
  );
  await action();
  return responsePromise;
}
