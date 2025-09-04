'use client'

import { forwardRef } from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => {
    return (
        <input
            ref={ref}
            className={`w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm
                  text-black
                  focus:border-black focus:ring-1 focus:ring-black focus:outline-none
                  [appearance:textfield]
                  autofill:bg-white autofill:text-black autofill:shadow-[inset_0_0_0px_1000px_white]
                  ${className}`}
            {...props}
        />
    )
})

Input.displayName = 'Input'

export default Input
