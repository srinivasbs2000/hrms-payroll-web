import {afterEach,describe,expect,test,vi} from 'vitest';
import {httpPayrollExecutionApi} from './payroll-execution-api';

function response(body:unknown,status=200):Response{
  return {
    ok:status>=200&&status<300,
    status,
    json:vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}

afterEach(()=>{
  vi.unstubAllGlobals();
  window.payrollSession=undefined;
});

describe('payroll execution HTTP client hardening',()=>{
  test('sends correlation, idempotency and numeric If-Match headers',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(response({
      cycleId:'cycle-1',
      calculationRequestId:'request-1',
      resultCount:1,
      grossTotal:90000,
      deductionTotal:0,
      netTotal:90000,
      resultSetHash:'a'.repeat(64),
      cycleVersionNo:4,
      completedAt:'2026-07-24T06:05:00Z',
      completedBy:'payroll-admin'
    }));
    vi.stubGlobal('fetch',fetchMock);
    window.payrollSession={accessToken:'token-1'};

    await httpPayrollExecutionApi.calculate('cycle-1',3);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    const headers=new Headers(init.headers);
    expect(url).toBe('/api/v1/payroll-cycles/cycle-1/calculation');
    expect(init.method).toBe('POST');
    expect(headers.get('If-Match')).toBe('3');
    expect(headers.get('Idempotency-Key')).toBeTruthy();
    expect(headers.get('X-Correlation-ID')).toBeTruthy();
    expect(headers.get('Authorization')).toBe('Bearer token-1');
  });

  test('sends the controlled recalculation reason as JSON',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(response({
      cycleId:'cycle-1',
      calculationRequestId:'request-2',
      supersededRequestId:'request-1',
      attemptNo:2,
      resultCount:1,
      grossTotal:90000,
      deductionTotal:0,
      netTotal:90000,
      resultSetHash:'b'.repeat(64),
      cycleVersionNo:5,
      completedAt:'2026-07-24T06:10:00Z',
      completedBy:'payroll-admin'
    }));
    vi.stubGlobal('fetch',fetchMock);

    await httpPayrollExecutionApi.recalculate(
      'cycle-1',4,'Approved payroll review rerun');

    const [,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    const headers=new Headers(init.headers);
    expect(headers.get('If-Match')).toBe('4');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({
      reason:'Approved payroll review rerun'
    });
  });

  test('surfaces an API problem detail for stale versions',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(response({
      status:409,
      detail:'Payroll cycle version is stale'
    },409));
    vi.stubGlobal('fetch',fetchMock);

    await expect(
      httpPayrollExecutionApi.sealInputs('cycle-1',1)
    ).rejects.toThrow('Payroll cycle version is stale');
  });

  test('does not add an idempotency key to reads',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(response([]));
    vi.stubGlobal('fetch',fetchMock);

    await httpPayrollExecutionApi.listCycles();

    const [,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    const headers=new Headers(init.headers);
    expect(headers.get('Idempotency-Key')).toBeNull();
    expect(headers.get('X-Correlation-ID')).toBeTruthy();
  });
});
