export default function ora() {
  const spinner = {
    text: '',
    start: (msg?: string) => { spinner.text = msg || spinner.text; return spinner; },
    succeed: () => spinner,
    fail: () => spinner,
    stop: () => spinner,
  } as any;
  return spinner;
}
