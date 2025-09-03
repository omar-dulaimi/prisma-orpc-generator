function makeFn() { return (s: any) => String(s); }
const chalkMock: any = makeFn();
['bold','cyan','green','yellow','red','blue','white','gray'].forEach(c => chalkMock[c] = makeFn());
export default chalkMock;
