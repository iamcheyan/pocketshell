import { createGesture } from "@pocketjs/framework/gesture";
import { View, type NodeMirror } from "@pocketjs/framework/solid/components";
import { createSignal } from "solid-js";

/** A pointer/touch hit target that does not join the gamepad focus graph. */
export function TouchTarget(props: {
  class?: string;
  style?: any;
  onPress: () => void;
  onMount?: (node: NodeMirror) => void;
  children?: JSX.Element;
}) {
  let node: NodeMirror | undefined;
  const [pressed, setPressed] = createSignal(false);
  createGesture({ region: { node: () => node }, onDown: () => setPressed(true),
    onUp: () => setPressed(false), onCancel: () => setPressed(false), onTap: () => props.onPress() });
  return <View ref={(value: NodeMirror) => { node = value; props.onMount?.(value); }} class={props.class} style={{ ...(props.style || {}), opacity: pressed() ? 0.7 : (props.style?.opacity ?? 1) }}>{props.children}</View>;
}
